import type { CrawlTaskRecord, PostRecord, ReviewQueueItem, SourceRecord, ToolRecord } from "@devtoollab/shared";
import { generateShortChineseArticle, type GeneratedArticleContent } from "./ai-content";
import { fetchArticleContent, type ArticleExtractionResult } from "./article-fetcher";
import { crawlSource, type FetchedItem } from "./crawlers";
import { exec, first, makeId, normalizeUrl, nowIso, run, sha256, slugify, truncate, uniqueSlug, asBoolean } from "./db";
import { getErrorLogDetails, logCrawlError, logCrawlEvent } from "./logger";
import { mapPost, mapReview, mapTask, mapTool } from "./mappers";
import type { Env, SqlRow } from "./types";

const REVIEW_EDITOR_NOTE = "Check source reliability and rewrite before publish.";

async function upsertDraftToolFromItem(
  db: D1Database,
  source: SourceRecord,
  item: FetchedItem
) {
  const timestamp = nowIso();
  const normalizedUrl = normalizeUrl(item.url);
  const existing = await first<SqlRow>(db, "SELECT * FROM tools WHERE website = ?", [normalizedUrl]);

  if (existing) {
    return mapTool(existing);
  }

  const id = makeId("tool");
  const slug = await uniqueSlug(db, "tools", slugify(item.title));

  await exec(
    db,
    `INSERT INTO tools (
      id, slug, name, summary, description, category, pricing, website, tags_json, status, featured, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'Free/Freemium', ?, ?, 'draft', 0, ?, ?)`,
    [
      id,
      slug,
      item.title,
      truncate(item.summary || "", 200),
      item.contentSnippet || item.summary || "",
      "Other",
      normalizedUrl,
      JSON.stringify([source.slug, "ingested"]),
      timestamp,
      timestamp
    ]
  );

  return mapTool((await first<SqlRow>(db, "SELECT * FROM tools WHERE id = ?", [id])) as SqlRow);
}

function buildSourceNote(sourceName: string) {
  return `Imported from ${sourceName}. Verify the original article and source context before publishing.`;
}

function buildFetchedItemPreview(items: FetchedItem[]) {
  return items.slice(0, 3).map((item) => ({
    title: truncate(item.title, 80),
    url: truncate(normalizeUrl(item.url), 160)
  }));
}

function buildPostContent(source: SourceRecord, item: FetchedItem, snippet: string) {
  const lines = [
    `Source: ${source.name}`,
    `Original URL: ${normalizeUrl(item.url)}`,
    item.author ? `Author: ${item.author}` : "",
    item.publishedAt ? `Published At: ${item.publishedAt}` : "",
    "",
    "Imported Snippet",
    snippet || "No snippet available yet.",
    "",
    "Editorial Notes",
    "- Verify facts and attribution before publishing.",
    "- Add your own analysis, related tools, FAQ and SEO fields."
  ];

  return lines.filter(Boolean).join("\n");
}

function mergeArticleExtraction(item: FetchedItem, extraction: ArticleExtractionResult): FetchedItem {
  return {
    ...item,
    contentSnippet: extraction.excerpt || item.contentSnippet || item.summary || ""
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
) {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.min(Math.max(concurrency, 1), items.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}

async function loadTaskWithSource(db: D1Database, taskId: string) {
  return first<SqlRow>(
    db,
    `SELECT
      crawl_tasks.*,
      sources.name AS source_name,
      sources.slug AS source_slug,
      sources.type AS source_type,
      sources.base_url AS source_base_url,
      sources.feed_url AS source_feed_url,
      sources.status AS source_status,
      sources.enabled AS source_enabled,
      sources.crawl_interval_minutes AS source_crawl_interval_minutes,
      sources.parser_key AS source_parser_key,
      sources.notes AS source_notes,
      sources.last_crawled_at AS source_last_crawled_at,
      sources.created_at AS source_created_at,
      sources.updated_at AS source_updated_at
     FROM crawl_tasks
     LEFT JOIN sources ON sources.id = crawl_tasks.source_id
     WHERE crawl_tasks.id = ?`,
    [taskId]
  );
}

function buildSourceFromTask(task: SqlRow): SourceRecord {
  return {
    id: String(task.source_id),
    name: String(task.source_name),
    slug: String(task.source_slug),
    type: String(task.source_type),
    baseUrl: String(task.source_base_url),
    feedUrl: String(task.target_url || task.source_feed_url || ""),
    status: String(task.source_status) as SourceRecord["status"],
    enabled: asBoolean(task.source_enabled),
    crawlIntervalMinutes: Number(task.source_crawl_interval_minutes ?? 60),
    parserKey: String(task.source_parser_key),
    notes: String(task.source_notes ?? ""),
    lastCrawledAt: task.source_last_crawled_at ? String(task.source_last_crawled_at) : null,
    createdAt: String(task.source_created_at),
    updatedAt: String(task.source_updated_at)
  };
}

async function updateTaskRunningState(db: D1Database, taskId: string, startedAt: string) {
  await exec(
    db,
    `UPDATE crawl_tasks
     SET status = 'running',
         requested_at = ?,
         started_at = ?,
         finished_at = NULL,
         items_found = 0,
         error_message = '',
         updated_at = ?
     WHERE id = ?`,
    [startedAt, startedAt, startedAt, taskId]
  );
}

async function updateTaskSuccessState(
  db: D1Database,
  taskId: string,
  sourceId: string,
  fetchedCount: number,
  queuedCount: number,
  finishedAt: string
) {
  const summary =
    fetchedCount > 0
      ? `Fetched ${fetchedCount} items and queued ${queuedCount} new records for review.`
      : "Crawler completed but no items were returned.";

  await exec(
    db,
    `UPDATE crawl_tasks
     SET status = 'completed',
         summary = ?,
         items_found = ?,
         error_message = '',
         finished_at = ?,
         updated_at = ?
     WHERE id = ?`,
    [summary, fetchedCount, finishedAt, finishedAt, taskId]
  );

  await exec(db, "UPDATE sources SET last_crawled_at = ?, updated_at = ? WHERE id = ?", [
    finishedAt,
    finishedAt,
    sourceId
  ]);
}

async function updateTaskFailureState(db: D1Database, taskId: string, message: string, finishedAt: string) {
  await exec(
    db,
    `UPDATE crawl_tasks
     SET status = 'failed',
         error_message = ?,
         finished_at = ?,
         updated_at = ?
     WHERE id = ?`,
    [message, finishedAt, finishedAt, taskId]
  );
}

async function upsertDraftPostFromItem(
  db: D1Database,
  source: SourceRecord,
  item: FetchedItem,
  generatedContent: GeneratedArticleContent
) {
  const timestamp = nowIso();
  const normalizedUrl = normalizeUrl(item.url);
  const summary = truncate(generatedContent.summary || item.summary || item.contentSnippet || item.title, 240);
  const sourceNote = generatedContent.sourceNote || buildSourceNote(source.name);
  const content = generatedContent.content || buildPostContent(source, item, item.contentSnippet || item.summary || "");
  const tags = generatedContent.tags.length > 0 ? generatedContent.tags : [source.slug, "ingested"];
  const existing = await first<SqlRow>(db, "SELECT * FROM posts WHERE source_url = ?", [normalizedUrl]);

  if (existing) {
    const post = mapPost(existing);
    if (post.status === "draft") {
      await exec(
        db,
        `UPDATE posts
         SET title = ?,
             summary = ?,
             content = ?,
             category = ?,
             tags_json = ?,
             source_name = ?,
             source_note = ?,
             review_feedback = '',
             updated_at = ?
         WHERE id = ?`,
        [generatedContent.title, summary, content, source.type, JSON.stringify(tags), source.name, sourceNote, timestamp, post.id]
      );
    }

    return mapPost((await first<SqlRow>(db, "SELECT * FROM posts WHERE id = ?", [post.id])) as SqlRow);
  }

  const id = makeId("post");
  const slug = await uniqueSlug(db, "posts", slugify(generatedContent.title || item.title));

  await exec(
    db,
    `INSERT INTO posts (
      id, slug, title, summary, content, category, tags_json, status, source_name, source_url,
      source_note, review_feedback, editor_note, related_tool_slugs_json, featured, created_at, updated_at, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, '', ?, '[]', 0, ?, ?, NULL)`,
    [
      id,
      slug,
      generatedContent.title,
      summary,
      content,
      source.type,
      JSON.stringify(tags),
      source.name,
      normalizedUrl,
      sourceNote,
      "Auto-created from crawler. Review before publishing.",
      timestamp,
      timestamp
    ]
  );

  return mapPost((await first<SqlRow>(db, "SELECT * FROM posts WHERE id = ?", [id])) as SqlRow);
}

async function ensureReviewQueueItem(
  db: D1Database,
  entity: PostRecord | ToolRecord,
  entityType: "post" | "tool",
  source: SourceRecord,
  item: FetchedItem
) {
  const timestamp = nowIso();
  const aiSummary = truncate(item.summary || item.contentSnippet || item.title, 320);
  const sourceUrl = normalizeUrl(item.url);
  const existing = await first<SqlRow>(db, "SELECT * FROM review_queue WHERE entity_id = ?", [entity.id]);

  if (existing) {
    await exec(
      db,
      `UPDATE review_queue
       SET title = ?,
           source_name = ?,
           source_url = ?,
           review_status = 'pending',
           ai_summary = ?,
           editor_note = ?,
           updated_at = ?,
           reviewed_at = NULL
       WHERE id = ?`,
      [
        entityType === "post" ? (entity as PostRecord).title : (entity as ToolRecord).name,
        source.name,
        sourceUrl,
        aiSummary,
        REVIEW_EDITOR_NOTE,
        timestamp,
        String(existing.id)
      ]
    );

    return mapReview((await first<SqlRow>(db, "SELECT * FROM review_queue WHERE id = ?", [String(existing.id)])) as SqlRow);
  }

  const reviewId = makeId("review");
  await exec(
    db,
    `INSERT INTO review_queue (
      id, entity_type, entity_id, entity_slug, title, source_name, source_url, review_status,
      ai_summary, editor_note, priority, queued_at, reviewed_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, 2, ?, NULL, ?)`,
    [
      reviewId,
      entityType,
      entity.id,
      entity.slug,
      entityType === "post" ? (entity as PostRecord).title : (entity as ToolRecord).name,
      source.name,
      sourceUrl,
      aiSummary,
      REVIEW_EDITOR_NOTE,
      timestamp,
      timestamp
    ]
  );

  return mapReview((await first<SqlRow>(db, "SELECT * FROM review_queue WHERE id = ?", [reviewId])) as SqlRow);
}

async function insertCrawlItemRecord(
  db: D1Database,
  taskId: string,
  sourceId: string,
  item: FetchedItem,
  dedupeHash: string,
  postId: string,
  reviewId: string,
  rawContent = "",
  extractionStatus = "not_started",
  aiOutputJson = "{}"
) {
  await exec(
    db,
    `INSERT INTO crawl_items (
      id, task_id, source_id, external_id, title, url, author, summary, content_snippet,
      raw_content, extraction_status, ai_output_json, published_at, dedupe_hash, created_post_id,
      review_queue_id, fetched_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      makeId("crawl"),
      taskId,
      sourceId,
      item.externalId ?? null,
      item.title,
      normalizeUrl(item.url),
      item.author ?? "",
      truncate(item.summary ?? "", 400),
      truncate(item.contentSnippet ?? "", 2000),
      truncate(rawContent, 16000),
      extractionStatus,
      aiOutputJson,
      item.publishedAt ?? null,
      dedupeHash,
      postId,
      reviewId,
      nowIso()
    ]
  );
}

export async function getTaskById(db: D1Database, id: string) {
  return first<SqlRow>(
    db,
    `SELECT crawl_tasks.*, sources.name AS source_name
     FROM crawl_tasks
     LEFT JOIN sources ON sources.id = crawl_tasks.source_id
     WHERE crawl_tasks.id = ?`,
    [id]
  );
}

type ScheduledTaskCandidate = {
  id: string;
  source_id: string;
  source_name: string;
  source_enabled: number;
  source_status: string;
  source_last_crawled_at: string | null;
  source_crawl_interval_minutes: number;
  source_parser_key: string;
  source_base_url: string;
  updated_at: string;
  requested_at: string;
};

function isSourceDue(lastCrawledAt: string | null, crawlIntervalMinutes: number, nowMs: number) {
  if (!lastCrawledAt) {
    return true;
  }

  const lastRunMs = Date.parse(lastCrawledAt);
  if (Number.isNaN(lastRunMs)) {
    return true;
  }

  return nowMs - lastRunMs >= Math.max(crawlIntervalMinutes, 1) * 60 * 1000;
}

export async function listDueScheduledTaskIds(db: D1Database, nowMs = Date.now()) {
  const rows = await run<ScheduledTaskCandidate>(
    db,
    `SELECT
       crawl_tasks.id,
       crawl_tasks.source_id,
       crawl_tasks.updated_at,
       crawl_tasks.requested_at,
       sources.name AS source_name,
       sources.enabled AS source_enabled,
       sources.status AS source_status,
       sources.last_crawled_at AS source_last_crawled_at,
       sources.crawl_interval_minutes AS source_crawl_interval_minutes,
       sources.parser_key AS source_parser_key,
       sources.base_url AS source_base_url
     FROM crawl_tasks
     INNER JOIN sources ON sources.id = crawl_tasks.source_id
     WHERE crawl_tasks.run_mode = 'scheduled'
       AND crawl_tasks.status != 'running'
       AND sources.enabled = 1
       AND sources.status = 'active'
       AND sources.parser_key != ''
       AND sources.base_url != ''
     ORDER BY crawl_tasks.updated_at DESC, crawl_tasks.requested_at DESC`
  );

  const selectedTaskIds: string[] = [];
  const seenSourceIds = new Set<string>();

  for (const row of rows) {
    const sourceId = String(row.source_id ?? "");
    if (!sourceId || seenSourceIds.has(sourceId)) {
      continue;
    }

    const crawlIntervalMinutes = Number(row.source_crawl_interval_minutes ?? 60);
    const lastCrawledAt = row.source_last_crawled_at ? String(row.source_last_crawled_at) : null;

    if (!isSourceDue(lastCrawledAt, crawlIntervalMinutes, nowMs)) {
      continue;
    }

    seenSourceIds.add(sourceId);
    selectedTaskIds.push(String(row.id));
  }

  return selectedTaskIds;
}

export async function executeCrawlTask(db: D1Database, env: Env, taskId: string): Promise<CrawlTaskRecord> {
  const taskStartedAtMs = Date.now();
  const task = await loadTaskWithSource(db, taskId);

  if (!task) {
    throw new Error("Task not found");
  }

  if (!task.source_id) {
    throw new Error("Task must be bound to a source before running");
  }

  if (!task.source_parser_key || !task.source_base_url) {
    throw new Error("Source is incomplete and cannot be crawled");
  }

  const source = buildSourceFromTask(task);
  const startedAt = nowIso();
  logCrawlEvent(db, "task_start", {
    taskId,
    taskTitle: String(task.title ?? ""),
    taskType: String(task.task_type ?? ""),
    runMode: String(task.run_mode ?? ""),
    sourceId: source.id,
    sourceName: source.name,
    sourceType: source.type,
    parserKey: source.parserKey,
    baseUrl: source.baseUrl,
    feedUrl: source.feedUrl
  });

  await updateTaskRunningState(db, taskId, startedAt);
  logCrawlEvent(db, "task_marked_running", { taskId, startedAt });

  try {
    logCrawlEvent(db, "fetch_start", {
      taskId,
      sourceId: source.id,
      parserKey: source.parserKey,
      feedUrl: source.feedUrl || source.baseUrl
    });

    const fetchedItems = await crawlSource({
      id: source.id,
      name: source.name,
      parserKey: source.parserKey,
      baseUrl: source.baseUrl,
      feedUrl: source.feedUrl
    });

    logCrawlEvent(db, "fetch_complete", {
      taskId,
      sourceId: source.id,
      fetchedCount: fetchedItems.length,
      preview: buildFetchedItemPreview(fetchedItems)
    });

    let queuedCount = 0;

    const results = await mapWithConcurrency(
      fetchedItems,
      2,
      async (item, index) => {
        try {
          const normalizedItem: FetchedItem = {
            ...item,
            url: normalizeUrl(item.url)
          };
          const dedupeKey = `${source.id}:${normalizedItem.externalId || normalizedItem.url}`;
          const dedupeHash = await sha256(dedupeKey);
          
          // Use a faster check
          const existingItem = await first<SqlRow>(db, "SELECT id FROM crawl_items WHERE dedupe_hash = ?", [
            dedupeHash
          ]);

          if (existingItem) {
            logCrawlEvent(db, "item_skipped_duplicate", {
              taskId,
              sourceId: source.id,
              itemIndex: index,
              title: truncate(normalizedItem.title, 120),
              url: truncate(normalizedItem.url, 180),
              dedupeHash
            });
            return null;
          }

          // Tool sources keep the lightweight metadata flow; article sources run the full content pipeline below.
          const chineseSummary = normalizedItem.summary || "";

          const isToolSource = source.type === "tool-directory" || source.parserKey === "product-hunt";
          
          if (isToolSource) {
            const tool = await upsertDraftToolFromItem(db, source, normalizedItem);
            const review = await ensureReviewQueueItem(db, tool, "tool", source, {
              ...normalizedItem,
              summary: chineseSummary
            });

            logCrawlEvent(db, "item_queued", {
              taskId,
              sourceId: source.id,
              itemIndex: index,
              entityType: "tool",
              entityId: tool.id,
              reviewId: review.id,
              title: truncate(normalizedItem.title, 120),
              url: truncate(normalizedItem.url, 180)
            });

            return {
              normalizedItem,
              dedupeHash,
              postId: null,
              toolId: tool.id,
              reviewId: review.id,
              rawContent: "",
              extractionStatus: "skipped",
              aiOutputJson: "{}"
            };
          } else {
            logCrawlEvent(db, "article_fetch_start", {
              taskId,
              sourceId: source.id,
              itemIndex: index,
              url: truncate(normalizedItem.url, 180)
            });

            const extraction = await fetchArticleContent(normalizedItem.url);
            logCrawlEvent(db, "article_fetch_complete", {
              taskId,
              sourceId: source.id,
              itemIndex: index,
              status: extraction.status,
              contentFound: extraction.status === "success" && extraction.text.length > 0,
              textLength: extraction.text.length,
              excerptLength: extraction.excerpt.length,
              contentPreview: truncate(extraction.text, 240),
              excerptPreview: truncate(extraction.excerpt, 240),
              errorMessage: extraction.errorMessage ?? ""
            });

            const enrichedItem = mergeArticleExtraction(normalizedItem, extraction);
            const generated = await generateShortChineseArticle(env, {
              sourceName: source.name,
              sourceType: source.type,
              title: enrichedItem.title,
              url: enrichedItem.url,
              author: enrichedItem.author,
              summary: enrichedItem.summary,
              contentSnippet: enrichedItem.contentSnippet,
              articleText: extraction.text,
              publishedAt: enrichedItem.publishedAt
            });

            logCrawlEvent(db, "ai_content_complete", {
              taskId,
              sourceId: source.id,
              itemIndex: index,
              generationMode: extraction.status === "success" ? (generated.usedFallback ? "fallback" : "ai") : "no_content",
              usedFallback: generated.usedFallback,
              model: generated.model,
              title: truncate(generated.title, 120),
              summaryLength: generated.summary.length,
              contentLength: generated.content.length,
              summaryPreview: truncate(generated.summary, 160),
              contentPreview: truncate(generated.content, 240)
            });

            const post = await upsertDraftPostFromItem(db, source, enrichedItem, generated);
            const review = await ensureReviewQueueItem(db, post, "post", source, {
              ...enrichedItem,
              title: generated.title,
              summary: generated.summary,
              contentSnippet: generated.content
            });

            logCrawlEvent(db, "item_queued", {
              taskId,
              sourceId: source.id,
              itemIndex: index,
              entityType: "post",
              entityId: post.id,
              reviewId: review.id,
              title: truncate(normalizedItem.title, 120),
              url: truncate(normalizedItem.url, 180)
            });

            return {
              normalizedItem: {
                ...enrichedItem,
                summary: generated.summary,
                contentSnippet: generated.content
              },
              dedupeHash,
              postId: post.id,
              toolId: null,
              reviewId: review.id,
              rawContent: extraction.text,
              extractionStatus: extraction.status,
              aiOutputJson: JSON.stringify(generated)
            };
          }
        } catch (error) {
          logCrawlError(db, "item_failed", {
            taskId,
            sourceId: source.id,
            itemIndex: index,
            title: truncate(item.title, 120),
            url: truncate(item.url, 180),
            ...getErrorLogDetails(error)
          });
          throw error;
        }
      }
    );

    const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null);
    const skippedCount = results.length - validResults.length;
    
    // Batch insert crawl items
    if (validResults.length > 0) {
      logCrawlEvent(db, "crawl_items_insert_start", {
        taskId,
        sourceId: source.id,
        insertCount: validResults.length
      });

      const statements = validResults.map((r) => {
        return db.prepare(`
          INSERT INTO crawl_items (
            id, task_id, source_id, external_id, title, url, author, summary, content_snippet,
            raw_content, extraction_status, ai_output_json, published_at, dedupe_hash, created_post_id,
            review_queue_id, fetched_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          makeId("crawl"),
          taskId,
          source.id,
          r.normalizedItem.externalId ?? null,
          r.normalizedItem.title,
          r.normalizedItem.url,
          r.normalizedItem.author ?? "",
          truncate(r.normalizedItem.summary ?? "", 400),
          truncate(r.normalizedItem.contentSnippet ?? "", 2000),
          truncate(r.rawContent, 16000),
          r.extractionStatus,
          r.aiOutputJson,
          r.normalizedItem.publishedAt ?? null,
          r.dedupeHash,
          r.postId || r.toolId, // Store the relevant created ID
          r.reviewId,
          nowIso()
        );
      });
      
      await db.batch(statements);
      queuedCount = validResults.length;
      logCrawlEvent(db, "crawl_items_insert_complete", {
        taskId,
        sourceId: source.id,
        insertCount: validResults.length
      });
    } else {
      logCrawlEvent(db, "crawl_items_insert_skipped", {
        taskId,
        sourceId: source.id,
        reason: "no_new_items"
      });
    }

    const finishedAt = nowIso();
    await updateTaskSuccessState(db, taskId, source.id, fetchedItems.length, queuedCount, finishedAt);
    logCrawlEvent(db, "task_complete", {
      taskId,
      sourceId: source.id,
      fetchedCount: fetchedItems.length,
      queuedCount,
      skippedCount,
      durationMs: Date.now() - taskStartedAtMs,
      finishedAt
    });

    return mapTask((await getTaskById(db, taskId)) as SqlRow);
  } catch (error) {
    const finishedAt = nowIso();
    const message = error instanceof Error ? error.message : "Unknown crawl error";
    await updateTaskFailureState(db, taskId, message, finishedAt);
    logCrawlError(db, "task_failed", {
      taskId,
      sourceId: source.id,
      durationMs: Date.now() - taskStartedAtMs,
      finishedAt,
      ...getErrorLogDetails(error)
    });
    throw error;
  }
}

export async function applyReviewDecision(
  db: D1Database,
  reviewId: string,
  reviewStatus: ReviewQueueItem["reviewStatus"],
  editorNote?: string
) {
  const timestamp = nowIso();
  const review = await first<SqlRow>(db, "SELECT * FROM review_queue WHERE id = ?", [reviewId]);

  if (!review) {
    return null;
  }

  const nextEditorNote = editorNote ?? String(review.editor_note ?? "");
  await exec(
    db,
    "UPDATE review_queue SET review_status = ?, editor_note = ?, reviewed_at = ?, updated_at = ? WHERE id = ?",
    [reviewStatus, nextEditorNote, reviewStatus === "pending" ? null : timestamp, timestamp, reviewId]
  );

  if (String(review.entity_type) === "post") {
    if (reviewStatus === "approved") {
      await exec(
        db,
        `UPDATE posts
         SET status = 'published',
             review_feedback = '',
             published_at = COALESCE(published_at, ?),
             updated_at = ?
         WHERE id = ?`,
        [timestamp, timestamp, String(review.entity_id)]
      );
    } else {
      await exec(
        db,
        `UPDATE posts
         SET review_feedback = ?,
             updated_at = ?
         WHERE id = ?`,
        [nextEditorNote, timestamp, String(review.entity_id)]
      );
    }
  }

  return first<SqlRow>(db, "SELECT * FROM review_queue WHERE id = ?", [reviewId]);
}

export async function deleteReviewEntityForRecrawl(db: D1Database, reviewId: string) {
  const review = await first<SqlRow>(db, "SELECT * FROM review_queue WHERE id = ?", [reviewId]);

  if (!review) {
    return null;
  }

  const entityType = String(review.entity_type);
  const entityId = String(review.entity_id);
  const sourceUrl = String(review.source_url ?? "");

  await exec(
    db,
    `DELETE FROM crawl_items
     WHERE review_queue_id = ?
        OR created_post_id = ?
        OR (? != '' AND url = ?)`,
    [reviewId, entityId, sourceUrl, sourceUrl]
  );

  await exec(db, "DELETE FROM review_queue WHERE id = ?", [reviewId]);

  if (entityType === "post") {
    await exec(db, "DELETE FROM posts WHERE id = ?", [entityId]);
  } else if (entityType === "tool") {
    await exec(db, "DELETE FROM tools WHERE id = ?", [entityId]);
  }

  return {
    id: reviewId,
    entityType,
    entityId,
    sourceUrl
  };
}
