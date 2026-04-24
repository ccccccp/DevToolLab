import type {
  CrawlItemRecord,
  CrawlLogRecord,
  CrawlTaskRecord,
  DashboardStats,
  PostRecord,
  ReviewQueueItem,
  SourceRecord,
  ToolRecord
} from "@devtoollab/shared";
import { asArray, asBoolean, run } from "./db";
import type { SqlRow } from "./types";

export function mapPost(row: SqlRow): PostRecord {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    summary: String(row.summary),
    content: String(row.content),
    category: String(row.category),
    tags: asArray(row.tags_json),
    status: String(row.status) as PostRecord["status"],
    sourceName: String(row.source_name ?? ""),
    sourceUrl: String(row.source_url ?? ""),
    sourceNote: String(row.source_note ?? ""),
    reviewFeedback: String(row.review_feedback ?? ""),
    editorNote: String(row.editor_note ?? ""),
    relatedToolSlugs: asArray(row.related_tool_slugs_json),
    featured: asBoolean(row.featured),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    publishedAt: row.published_at ? String(row.published_at) : null
  };
}

export function mapTool(row: SqlRow): ToolRecord {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    summary: String(row.summary),
    description: String(row.description),
    category: String(row.category),
    pricing: String(row.pricing),
    website: String(row.website),
    tags: asArray(row.tags_json),
    status: String(row.status) as ToolRecord["status"],
    featured: asBoolean(row.featured),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapSource(row: SqlRow): SourceRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    type: String(row.type),
    baseUrl: String(row.base_url),
    feedUrl: String(row.feed_url ?? ""),
    status: String(row.status) as SourceRecord["status"],
    enabled: asBoolean(row.enabled),
    crawlIntervalMinutes: Number(row.crawl_interval_minutes),
    parserKey: String(row.parser_key ?? ""),
    notes: String(row.notes ?? ""),
    lastCrawledAt: row.last_crawled_at ? String(row.last_crawled_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

export function mapTask(row: SqlRow): CrawlTaskRecord {
  return {
    id: String(row.id),
    sourceId: row.source_id ? String(row.source_id) : null,
    sourceName: row.source_name ? String(row.source_name) : null,
    title: String(row.title),
    taskType: String(row.task_type) as CrawlTaskRecord["taskType"],
    status: String(row.status) as CrawlTaskRecord["status"],
    runMode: String(row.run_mode) as CrawlTaskRecord["runMode"],
    targetUrl: String(row.target_url ?? ""),
    summary: String(row.summary ?? ""),
    itemsFound: Number(row.items_found ?? 0),
    errorMessage: String(row.error_message ?? ""),
    requestedAt: String(row.requested_at),
    startedAt: row.started_at ? String(row.started_at) : null,
    finishedAt: row.finished_at ? String(row.finished_at) : null,
    updatedAt: String(row.updated_at)
  };
}

export function mapReview(row: SqlRow): ReviewQueueItem {
  return {
    id: String(row.id),
    entityType: String(row.entity_type) as ReviewQueueItem["entityType"],
    entityId: String(row.entity_id),
    entitySlug: String(row.entity_slug),
    title: String(row.title),
    sourceName: String(row.source_name ?? ""),
    sourceUrl: String(row.source_url ?? ""),
    reviewStatus: String(row.review_status) as ReviewQueueItem["reviewStatus"],
    aiSummary: String(row.ai_summary ?? ""),
    editorNote: String(row.editor_note ?? ""),
    priority: Number(row.priority ?? 3),
    queuedAt: String(row.queued_at),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : null,
    updatedAt: String(row.updated_at)
  };
}

export function mapCrawlItem(row: SqlRow): CrawlItemRecord {
  return {
    id: String(row.id),
    taskId: String(row.task_id),
    sourceId: String(row.source_id),
    sourceName: String(row.source_name ?? ""),
    externalId: row.external_id ? String(row.external_id) : null,
    title: String(row.title),
    url: String(row.url),
    author: String(row.author ?? ""),
    summary: String(row.summary ?? ""),
    contentSnippet: String(row.content_snippet ?? ""),
    rawContent: String(row.raw_content ?? ""),
    extractionStatus: String(row.extraction_status ?? ""),
    aiOutputJson: String(row.ai_output_json ?? "{}"),
    publishedAt: row.published_at ? String(row.published_at) : null,
    dedupeHash: String(row.dedupe_hash),
    createdPostId: row.created_post_id ? String(row.created_post_id) : null,
    reviewQueueId: row.review_queue_id ? String(row.review_queue_id) : null,
    fetchedAt: String(row.fetched_at)
  };
}

export function mapCrawlLog(row: SqlRow): CrawlLogRecord {
  return {
    id: Number(row.id),
    taskId: String(row.task_id),
    level: String(row.level) as CrawlLogRecord["level"],
    eventType: String(row.event_type),
    message: String(row.message),
    payloadJson: String(row.payload_json ?? "{}"),
    createdAt: String(row.created_at)
  };
}

export async function getStats(db: D1Database): Promise<DashboardStats> {
  const [postStats] = await run<{ total: number; published: number; draft: number }>(
    db,
    "SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published, SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft FROM posts"
  );
  const [toolStats] = await run<{ total: number; published: number; featured: number }>(
    db,
    "SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published, SUM(CASE WHEN featured = 1 THEN 1 ELSE 0 END) AS featured FROM tools"
  );
  const [sourceStats] = await run<{ total: number; active: number }>(
    db,
    "SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active FROM sources"
  );
  const [taskStats] = await run<{ total: number }>(db, "SELECT COUNT(*) AS total FROM crawl_tasks");
  const [crawlItemStats] = await run<{ total: number }>(db, "SELECT COUNT(*) AS total FROM crawl_items");
  const [reviewStats] = await run<{ pending: number }>(
    db,
    "SELECT COUNT(*) AS pending FROM review_queue WHERE review_status = 'pending'"
  );

  return {
    posts: Number(postStats?.total ?? 0),
    publishedPosts: Number(postStats?.published ?? 0),
    draftPosts: Number(postStats?.draft ?? 0),
    tools: Number(toolStats?.total ?? 0),
    publishedTools: Number(toolStats?.published ?? 0),
    featuredTools: Number(toolStats?.featured ?? 0),
    sources: Number(sourceStats?.total ?? 0),
    activeSources: Number(sourceStats?.active ?? 0),
    crawlTasks: Number(taskStats?.total ?? 0),
    crawlItems: Number(crawlItemStats?.total ?? 0),
    pendingReviews: Number(reviewStats?.pending ?? 0)
  };
}
