import { Hono } from "hono";
import { cors } from "hono/cors";
import type { CrawlTaskRecord, ReviewQueueItem, SourceRecord, ToolRecord } from "@devtoollab/shared";
import {
  adminSections,
  isCrawlRunMode,
  isCrawlTaskType,
  pipelineStages,
  siteMeta
} from "@devtoollab/shared";
import { exec, first, makeId, nowIso, run, slugify, uniqueSlug } from "./db";
import { logRuntimeEnv } from "./logger";
import { getStats, mapCrawlItem, mapCrawlLog, mapPost, mapReview, mapSource, mapTask, mapTool } from "./mappers";
import {
  applyReviewDecision,
  deleteReviewEntityForRecrawl,
  executeCrawlTask,
  getTaskById
} from "./pipeline";
import {
  bootstrapAdminUser,
  createAdminUser,
  getAdminUserById,
  listAdminUsers,
  updateAdminUserDisplayName,
  updateAdminUserPassword,
  updateAdminUserStatus,
  verifyAdminPassword
} from "./admin-users";
import { deletePostById, deletePostBySlug, getPostById, savePost } from "./post-service";
import type { Env, SqlRow } from "./types";

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

const OPEN_ADMIN_AUTH_PATHS = new Set(["/api/admin/auth/login", "/api/admin/auth/bootstrap"]);

let hasLoggedRuntimeEnv = false;

function getRequiredWorkerSecret(env: Env) {
  return env.DEVTOOLLAB_WORKER_API_SECRET?.trim() || "";
}

function isAdminProtectedRoute(pathname: string, method: string) {
  if (OPEN_ADMIN_AUTH_PATHS.has(pathname)) {
    return false;
  }

  if (pathname.startsWith("/api/admin/")) {
    return true;
  }

  return !["GET", "HEAD", "OPTIONS"].includes(method) && pathname.startsWith("/api/");
}

function isValidWorkerAuth(request: Request, env: Env) {
  const provided = request.headers.get("x-devtoollab-worker-secret")?.trim();
  return Boolean(provided && provided === getRequiredWorkerSecret(env));
}

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.use("/api/*", cors());
  app.use("/api/*", async (c, next) => {
    if (!isAdminProtectedRoute(c.req.path, c.req.method)) {
      await next();
      return;
    }

    if (!isValidWorkerAuth(c.req.raw, c.env)) {
      return c.json({ ok: false, error: "Unauthorized worker request" }, 401);
    }

    await next();
  });
  app.use("*", async (c, next) => {
    if (!hasLoggedRuntimeEnv) {
      logRuntimeEnv(c.env);
      hasLoggedRuntimeEnv = true;
    }

    await next();
  });

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

  app.get("/api/admin/users", async (c) => c.json(await listAdminUsers(c.env.DB)));

  app.get("/api/admin/users/:id", async (c) => {
    return c.json(await getAdminUserById(c.env.DB, c.req.param("id")));
  });

  app.post("/api/admin/auth/login", async (c) => {
    const payload = (await c.req.json()) as { email?: string; password?: string };
    if (!payload.email || !payload.password) {
      return c.json({ ok: false, error: "Email and password are required" }, 400);
    }

    const user = await verifyAdminPassword(c.env.DB, payload.email, payload.password);
    if (!user) {
      return c.json({ ok: false, error: "Invalid credentials" }, 401);
    }

    return c.json({ user });
  });

  app.post("/api/admin/auth/bootstrap", async (c) => {
    const payload = (await c.req.json()) as {
      email?: string;
      password?: string;
      displayName?: string;
      role?: "admin" | "editor";
    };

    if (!payload.email || !payload.password || !payload.displayName) {
      return c.json({ ok: false, error: "Email, password and display name are required" }, 400);
    }

    const user = await bootstrapAdminUser(c.env.DB, {
      email: payload.email,
      password: payload.password,
      displayName: payload.displayName,
      role: payload.role ?? "admin"
    });

    if (!user) {
      return c.json({ ok: false, error: "Bootstrap is only available before the first user exists" }, 409);
    }

    return c.json({ user });
  });

  app.post("/api/admin/users", async (c) => {
    const payload = (await c.req.json()) as {
      email?: string;
      password?: string;
      displayName?: string;
      role?: "admin" | "editor";
      status?: "active" | "disabled";
    };

    if (!payload.email || !payload.password || !payload.displayName) {
      return c.json({ ok: false, error: "Email, password and display name are required" }, 400);
    }

    try {
      const user = await createAdminUser(c.env.DB, {
        email: payload.email,
        password: payload.password,
        displayName: payload.displayName,
        role: payload.role ?? "editor",
        status: payload.status ?? "active"
      });

      return c.json(user);
    } catch (error) {
      return c.json(
        {
          ok: false,
          error: error instanceof Error ? error.message : "Unable to create admin user"
        },
        400
      );
    }
  });

  app.post("/api/admin/users/:id/status", async (c) => {
    const payload = (await c.req.json()) as { status?: "active" | "disabled" };
    if (!payload.status) {
      return c.json({ ok: false, error: "Status is required" }, 400);
    }

    const user = await updateAdminUserStatus(c.env.DB, c.req.param("id"), payload.status);
    if (!user) {
      return c.json({ ok: false, error: "Admin user not found" }, 404);
    }

    return c.json(user);
  });

  app.post("/api/admin/users/:id/password", async (c) => {
    const payload = (await c.req.json()) as { password?: string };
    if (!payload.password) {
      return c.json({ ok: false, error: "Password is required" }, 400);
    }

    const user = await updateAdminUserPassword(c.env.DB, c.req.param("id"), payload.password);
    if (!user) {
      return c.json({ ok: false, error: "Admin user not found" }, 404);
    }

    return c.json(user);
  });

  app.post("/api/admin/users/:id/profile", async (c) => {
    const payload = (await c.req.json()) as { displayName?: string };
    if (!payload.displayName?.trim()) {
      return c.json({ ok: false, error: "Display name is required" }, 400);
    }

    const user = await updateAdminUserDisplayName(c.env.DB, c.req.param("id"), payload.displayName);
    if (!user) {
      return c.json({ ok: false, error: "Admin user not found" }, 404);
    }

    return c.json(user);
  });

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

  app.get("/api/posts/id/:id", async (c) => {
    const row = await getPostById(c.env.DB, c.req.param("id"));
    return c.json(row ? mapPost(row) : null);
  });

  app.post("/api/posts", async (c) => {
    const saved = await savePost(c.env.DB, (await c.req.json()) as Parameters<typeof savePost>[1]);
    if (!saved) {
      return c.json({ ok: false, error: "Post was saved but could not be reloaded" }, 500);
    }

    return c.json(mapPost(saved));
  });

  app.delete("/api/posts/:slug", async (c) => {
    const result = await deletePostBySlug(c.env.DB, c.req.param("slug"));
    if (!result.ok) {
      return c.json({ ok: false, error: result.error }, 400);
    }

    return c.json({ ok: true });
  });

  app.delete("/api/posts/id/:id", async (c) => {
    const result = await deletePostById(c.env.DB, c.req.param("id"));
    if (!result.ok) {
      return c.json({ ok: false, error: result.error }, 400);
    }

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
    const current = payload.id
      ? await first<SqlRow>(c.env.DB, "SELECT * FROM sources WHERE id = ?", [payload.id])
      : null;
    const id = current ? String(current.id) : makeId("source");
    const slug = await uniqueSlug(
      c.env.DB,
      "sources",
      slugify(payload.slug || payload.name || ""),
      current ? String(current.slug) : undefined
    );

    await exec(
      c.env.DB,
      `INSERT INTO sources (
        id, name, slug, type, base_url, feed_url, status, enabled, crawl_interval_minutes, parser_key, notes, last_crawled_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        slug = excluded.slug,
        type = excluded.type,
        base_url = excluded.base_url,
        feed_url = excluded.feed_url,
        status = excluded.status,
        enabled = excluded.enabled,
        crawl_interval_minutes = excluded.crawl_interval_minutes,
        parser_key = excluded.parser_key,
        notes = excluded.notes,
        updated_at = excluded.updated_at`,
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
        current?.last_crawled_at ? String(current.last_crawled_at) : null,
        current?.created_at ? String(current.created_at) : timestamp,
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

  return app;
}
