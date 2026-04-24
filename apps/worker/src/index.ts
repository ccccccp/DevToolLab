import { Hono } from "hono";
import { cors } from "hono/cors";
import type { CrawlTaskRecord, PostRecord, ReviewQueueItem, SourceRecord, ToolRecord } from "@devtoollab/shared";
import {
  adminSections,
  isCrawlRunMode,
  isCrawlTaskType,
  pipelineStages,
  siteMeta
} from "@devtoollab/shared";
import { exec, first, makeId, nowIso, slugify, uniqueSlug, run } from "./db";
import { logRuntimeEnv } from "./logger";
import { getStats, mapCrawlItem, mapCrawlLog, mapPost, mapReview, mapSource, mapTask, mapTool } from "./mappers";
import { applyReviewDecision, deleteReviewEntityForRecrawl, executeCrawlTask, getTaskById } from "./pipeline";
import type { Env, SqlRow } from "./types";

const app = new Hono<{ Bindings: Env }>();
let hasLoggedRuntimeEnv = false;

app.use("/api/*", cors());
app.use("*", async (c, next) => {
  if (!hasLoggedRuntimeEnv) {
    logRuntimeEnv(c.env);
    hasLoggedRuntimeEnv = true;
  }

  await next();
});

const TASK_LIST_SQL = `SELECT crawl_tasks.*, sources.name AS source_name
  FROM crawl_tasks
  LEFT JOIN sources ON sources.id = crawl_tasks.source_id
  ORDER BY requested_at DESC`;

const TASK_BY_ID_SQL = `SELECT crawl_tasks.*, sources.name AS source_name
  FROM crawl_tasks
  LEFT JOIN sources ON sources.id = crawl_tasks.source_id
  WHERE crawl_tasks.id = ?`;

const TASK_LOGS_SQL = `SELECT * FROM crawl_logs WHERE task_id = ? ORDER BY created_at ASC`;

const CRAWL_ITEM_LIST_SQL = `SELECT crawl_items.*, sources.name AS source_name
  FROM crawl_items
  LEFT JOIN sources ON sources.id = crawl_items.source_id
  ORDER BY fetched_at DESC`;

app.get("/", (c) =>
  c.json({
    name: siteMeta.name,
    service: "worker",
    message: "DevToolLab worker is running"
  })
);

app.get("/health", async (c) => {
  const stats = await getStats(c.env.DB);
  return c.json({
    ok: true,
    timestamp: nowIso(),
    stats
  });
});

app.get("/api/dashboard", async (c) => c.json(await getStats(c.env.DB)));

app.get("/api/seed", (c) =>
  c.json({
    adminSections,
    pipelineStages
  })
);

app.get("/api/pipeline", (c) =>
  c.json({
    stages: pipelineStages.map((stage, index) => ({
      step: index + 1,
      ...stage
    }))
  })
);

app.get("/api/posts", async (c) => {
  const status = c.req.query("status");
  const rows = await run<SqlRow>(
    c.env.DB,
    `SELECT * FROM posts ${status && status !== "all" ? "WHERE status = ?" : ""} ORDER BY COALESCE(published_at, updated_at) DESC`,
    status && status !== "all" ? [status] : []
  );

  return c.json(rows.map(mapPost));
});

app.get("/api/posts/:slug", async (c) => {
  const row = await first<SqlRow>(c.env.DB, "SELECT * FROM posts WHERE slug = ?", [c.req.param("slug")]);
  return c.json(row ? mapPost(row) : null);
});

app.post("/api/posts", async (c) => {
  const payload = (await c.req.json()) as Partial<PostRecord> & { currentSlug?: string };
  const current = payload.currentSlug
    ? await first<SqlRow>(c.env.DB, "SELECT * FROM posts WHERE slug = ?", [payload.currentSlug])
    : null;
  const slug = await uniqueSlug(
    c.env.DB,
    "posts",
    slugify(payload.slug || payload.title || ""),
    current ? String(current.slug) : undefined
  );
  const id = current ? String(current.id) : makeId("post");
  const timestamp = nowIso();
  const status = payload.status === "published" ? "published" : "draft";
  const publishedAt =
    status === "published" ? (current?.published_at ? String(current.published_at) : timestamp) : null;

  await exec(
    c.env.DB,
    `INSERT INTO posts (
      id, slug, title, summary, content, category, tags_json, status, source_name, source_url,
      source_note, review_feedback, editor_note, related_tool_slugs_json, featured, created_at, updated_at, published_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      title = excluded.title,
      summary = excluded.summary,
      content = excluded.content,
      category = excluded.category,
      tags_json = excluded.tags_json,
      status = excluded.status,
      source_name = excluded.source_name,
      source_url = excluded.source_url,
      source_note = excluded.source_note,
      review_feedback = excluded.review_feedback,
      editor_note = excluded.editor_note,
      related_tool_slugs_json = excluded.related_tool_slugs_json,
      featured = excluded.featured,
      updated_at = excluded.updated_at,
      published_at = excluded.published_at`,
    [
      id,
      slug,
      payload.title ?? "",
      payload.summary ?? "",
      payload.content ?? "",
      payload.category ?? "",
      JSON.stringify(payload.tags ?? []),
      status,
      payload.sourceName ?? "",
      payload.sourceUrl ?? "",
      payload.sourceNote ?? "",
      payload.reviewFeedback ?? "",
      payload.editorNote ?? "",
      JSON.stringify(payload.relatedToolSlugs ?? []),
      payload.featured ? 1 : 0,
      current?.created_at ? String(current.created_at) : timestamp,
      timestamp,
      publishedAt
    ]
  );

  await exec(
    c.env.DB,
    `UPDATE review_queue
     SET entity_slug = ?,
         title = ?,
         source_name = ?,
         source_url = ?,
         ai_summary = ?,
         updated_at = ?
     WHERE entity_type = 'post' AND entity_id = ?`,
    [slug, payload.title ?? "", payload.sourceName ?? "", payload.sourceUrl ?? "", payload.summary ?? "", timestamp, id]
  );

  const saved = await first<SqlRow>(c.env.DB, "SELECT * FROM posts WHERE id = ?", [id]);
  return c.json(mapPost(saved as SqlRow));
});

app.delete("/api/posts/:slug", async (c) => {
  const slug = c.req.param("slug");
  const post = await first<SqlRow>(c.env.DB, "SELECT status FROM posts WHERE slug = ?", [slug]);
  
  if (!post) {
    return c.json({ ok: true });
  }

  if (String(post.status) === "published") {
    return c.json({ ok: false, error: "已发布的文章不允许删除，请先撤回为草稿状态。" }, 400);
  }

  await exec(c.env.DB, "DELETE FROM posts WHERE slug = ?", [slug]);
  return c.json({ ok: true });
});

app.get("/api/tools", async (c) => {
  const status = c.req.query("status");
  const rows = await run<SqlRow>(
    c.env.DB,
    `SELECT * FROM tools ${status && status !== "all" ? "WHERE status = ?" : ""} ORDER BY updated_at DESC`,
    status && status !== "all" ? [status] : []
  );

  return c.json(rows.map(mapTool));
});

app.get("/api/tools/:slug", async (c) => {
  const row = await first<SqlRow>(c.env.DB, "SELECT * FROM tools WHERE slug = ?", [c.req.param("slug")]);
  return c.json(row ? mapTool(row) : null);
});

app.post("/api/tools", async (c) => {
  const payload = (await c.req.json()) as Partial<ToolRecord> & { currentSlug?: string };
  const current = payload.currentSlug
    ? await first<SqlRow>(c.env.DB, "SELECT * FROM tools WHERE slug = ?", [payload.currentSlug])
    : null;
  const slug = await uniqueSlug(
    c.env.DB,
    "tools",
    slugify(payload.slug || payload.name || ""),
    current ? String(current.slug) : undefined
  );
  const id = current ? String(current.id) : makeId("tool");
  const timestamp = nowIso();

  await exec(
    c.env.DB,
    `INSERT INTO tools (
      id, slug, name, summary, description, category, pricing, website, tags_json, status, featured, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      slug = excluded.slug,
      name = excluded.name,
      summary = excluded.summary,
      description = excluded.description,
      category = excluded.category,
      pricing = excluded.pricing,
      website = excluded.website,
      tags_json = excluded.tags_json,
      status = excluded.status,
      featured = excluded.featured,
      updated_at = excluded.updated_at`,
    [
      id,
      slug,
      payload.name ?? "",
      payload.summary ?? "",
      payload.description ?? "",
      payload.category ?? "",
      payload.pricing ?? "",
      payload.website ?? "",
      JSON.stringify(payload.tags ?? []),
      payload.status === "published" ? "published" : "draft",
      payload.featured ? 1 : 0,
      current?.created_at ? String(current.created_at) : timestamp,
      timestamp
    ]
  );

  const saved = await first<SqlRow>(c.env.DB, "SELECT * FROM tools WHERE id = ?", [id]);
  return c.json(mapTool(saved as SqlRow));
});

app.delete("/api/tools/:slug", async (c) => {
  const tool = await first<SqlRow>(c.env.DB, "SELECT id, slug FROM tools WHERE slug = ?", [c.req.param("slug")]);
  if (!tool) {
    return c.json({ ok: true });
  }

  const posts = await run<SqlRow>(c.env.DB, "SELECT * FROM posts");
  for (const row of posts) {
    const post = mapPost(row);
    if (!post.relatedToolSlugs.includes(String(tool.slug))) {
      continue;
    }

    await exec(
      c.env.DB,
      "UPDATE posts SET related_tool_slugs_json = ?, updated_at = ? WHERE id = ?",
      [JSON.stringify(post.relatedToolSlugs.filter((item) => item !== String(tool.slug))), nowIso(), post.id]
    );
  }

  await exec(c.env.DB, "DELETE FROM tools WHERE slug = ?", [c.req.param("slug")]);
  return c.json({ ok: true });
});

app.get("/api/sources", async (c) => {
  const rows = await run<SqlRow>(c.env.DB, "SELECT * FROM sources ORDER BY updated_at DESC");
  return c.json(rows.map(mapSource));
});

app.post("/api/sources", async (c) => {
  const payload = (await c.req.json()) as Partial<SourceRecord>;
  const timestamp = nowIso();
  const id = makeId("source");
  const slug = await uniqueSlug(c.env.DB, "sources", slugify(payload.slug || payload.name || ""));

  await exec(
    c.env.DB,
    `INSERT INTO sources (
      id, name, slug, type, base_url, feed_url, status, enabled, crawl_interval_minutes, parser_key, notes, last_crawled_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.name ?? "",
      slug,
      payload.type ?? "news",
      payload.baseUrl ?? "",
      payload.feedUrl ?? "",
      payload.status ?? "active",
      payload.enabled === false ? 0 : 1,
      payload.crawlIntervalMinutes ?? 60,
      payload.parserKey ?? "",
      payload.notes ?? "",
      null,
      timestamp,
      timestamp
    ]
  );

  const saved = await first<SqlRow>(c.env.DB, "SELECT * FROM sources WHERE id = ?", [id]);
  return c.json(mapSource(saved as SqlRow));
});

app.post("/api/sources/:id/status", async (c) => {
  const { status } = (await c.req.json()) as { status: SourceRecord["status"] };
  const timestamp = nowIso();

  await exec(c.env.DB, "UPDATE sources SET status = ?, updated_at = ? WHERE id = ?", [
    status,
    timestamp,
    c.req.param("id")
  ]);

  const saved = await first<SqlRow>(c.env.DB, "SELECT * FROM sources WHERE id = ?", [c.req.param("id")]);
  return c.json(mapSource(saved as SqlRow));
});

app.get("/api/tasks", async (c) => {
  const rows = await run<SqlRow>(c.env.DB, TASK_LIST_SQL);
  return c.json(rows.map(mapTask));
});

app.post("/api/tasks", async (c) => {
  const payload = (await c.req.json()) as Partial<CrawlTaskRecord>;
  const taskType = payload.taskType ?? "crawl";
  const runMode = payload.runMode ?? "manual";

  if (!isCrawlTaskType(taskType)) {
    return c.json({ ok: false, error: `Unsupported task type: ${String(payload.taskType ?? "")}` }, 400);
  }

  if (!isCrawlRunMode(runMode)) {
    return c.json({ ok: false, error: `Unsupported run mode: ${String(payload.runMode ?? "")}` }, 400);
  }

  const timestamp = nowIso();
  const id = makeId("task");

  await exec(
    c.env.DB,
    `INSERT INTO crawl_tasks (
      id, source_id, title, task_type, status, run_mode, target_url, summary, items_found, error_message, requested_at, started_at, finished_at, updated_at
    ) VALUES (?, ?, ?, ?, 'pending', ?, ?, ?, 0, '', ?, NULL, NULL, ?)`,
    [
      id,
      payload.sourceId ?? null,
      payload.title ?? "",
      taskType,
      runMode,
      payload.targetUrl ?? "",
      payload.summary ?? "",
      timestamp,
      timestamp
    ]
  );

  const saved = await getTaskById(c.env.DB, id);
  return c.json(mapTask(saved as SqlRow));
});

app.post("/api/tasks/:id/run", async (c) => {
  try {
    const saved = await executeCrawlTask(c.env.DB, c.env, c.req.param("id"));
    return c.json(saved);
  } catch (error) {
    return c.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown crawl error"
      },
      500
    );
  }
});

app.get("/api/tasks/:id/logs", async (c) => {
  const rows = await run<SqlRow>(c.env.DB, TASK_LOGS_SQL, [c.req.param("id")]);
  return c.json(rows.map(mapCrawlLog));
});

app.get("/api/crawl-logs", async (c) => {
  try {
    const rows = await run<SqlRow>(c.env.DB, "SELECT * FROM crawl_logs ORDER BY created_at DESC LIMIT 200");
    return c.json(rows.map(mapCrawlLog));
  } catch (error) {
    return c.json({ ok: false, error: error instanceof Error ? error.message : "Database error" }, 500);
  }
});

app.post("/api/tasks/:id/status", async (c) => {
  const { status } = (await c.req.json()) as { status: CrawlTaskRecord["status"] };
  const timestamp = nowIso();
  const startedAt = status === "running" ? timestamp : null;
  const finishedAt = status === "completed" || status === "failed" ? timestamp : null;

  await exec(
    c.env.DB,
    `UPDATE crawl_tasks
     SET status = ?,
         started_at = COALESCE(?, started_at),
         finished_at = ?,
         updated_at = ?
     WHERE id = ?`,
    [status, startedAt, finishedAt, timestamp, c.req.param("id")]
  );

  const taskRow = await first<SqlRow>(c.env.DB, "SELECT source_id FROM crawl_tasks WHERE id = ?", [c.req.param("id")]);
  if (taskRow?.source_id && status === "completed") {
    await exec(c.env.DB, "UPDATE sources SET last_crawled_at = ?, updated_at = ? WHERE id = ?", [
      timestamp,
      timestamp,
      String(taskRow.source_id)
    ]);
  }

  const saved = await first<SqlRow>(c.env.DB, TASK_BY_ID_SQL, [c.req.param("id")]);
  return c.json(mapTask(saved as SqlRow));
});

app.get("/api/crawl-items", async (c) => {
  const rows = await run<SqlRow>(c.env.DB, CRAWL_ITEM_LIST_SQL);
  return c.json(rows.map(mapCrawlItem));
});

app.get("/api/reviews", async (c) => {
  const rows = await run<SqlRow>(c.env.DB, "SELECT * FROM review_queue ORDER BY priority ASC, queued_at DESC");
  return c.json(rows.map(mapReview));
});

app.post("/api/reviews", async (c) => {
  const payload = (await c.req.json()) as Partial<ReviewQueueItem>;
  const id = makeId("review");
  const timestamp = nowIso();

  await exec(
    c.env.DB,
    `INSERT INTO review_queue (
      id, entity_type, entity_id, entity_slug, title, source_name, source_url, review_status, ai_summary, editor_note, priority, queued_at, reviewed_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, NULL, ?)`,
    [
      id,
      payload.entityType ?? "post",
      payload.entityId ?? "",
      payload.entitySlug ?? "",
      payload.title ?? "",
      payload.sourceName ?? "",
      payload.sourceUrl ?? "",
      payload.aiSummary ?? "",
      payload.editorNote ?? "",
      payload.priority ?? 3,
      timestamp,
      timestamp
    ]
  );

  const saved = await first<SqlRow>(c.env.DB, "SELECT * FROM review_queue WHERE id = ?", [id]);
  return c.json(mapReview(saved as SqlRow));
});

app.post("/api/reviews/:id/status", async (c) => {
  const { reviewStatus, editorNote } = (await c.req.json()) as {
    reviewStatus: ReviewQueueItem["reviewStatus"];
    editorNote?: string;
  };

  const saved = await applyReviewDecision(c.env.DB, c.req.param("id"), reviewStatus, editorNote);
  if (!saved) {
    return c.json({ ok: false, error: "Review not found" }, 404);
  }

  return c.json(mapReview(saved));
});

app.delete("/api/reviews/:id", async (c) => {
  const deleted = await deleteReviewEntityForRecrawl(c.env.DB, c.req.param("id"));
  if (!deleted) {
    return c.json({ ok: false, error: "Review not found" }, 404);
  }

  return c.json({ ok: true, deleted });
});

export default app;
