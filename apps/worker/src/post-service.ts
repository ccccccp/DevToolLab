import type { PostRecord } from "@devtoollab/shared";
import { exec, first, makeId, nowIso, run, slugify, uniqueSlug } from "./db";
import type { SqlRow } from "./types";

type SavePostPayload = Partial<PostRecord> & { currentSlug?: string };

async function getTableColumns(db: D1Database, tableName: string) {
  const rows = await run<SqlRow>(db, `PRAGMA table_info(${tableName})`);
  return new Set(rows.map((row) => String(row.name ?? "")));
}

async function syncReviewQueueForPost(
  db: D1Database,
  payload: SavePostPayload,
  postId: string,
  slug: string,
  status: PostRecord["status"],
  timestamp: string
) {
  const reviewQueueColumns = await getTableColumns(db, "review_queue");
  const reviewAssignments: string[] = [];
  const reviewBindings: unknown[] = [];

  if (reviewQueueColumns.has("entity_slug")) {
    reviewAssignments.push("entity_slug = ?");
    reviewBindings.push(slug);
  }

  if (reviewQueueColumns.has("title")) {
    reviewAssignments.push("title = ?");
    reviewBindings.push(payload.title ?? "");
  }

  if (reviewQueueColumns.has("source_name")) {
    reviewAssignments.push("source_name = ?");
    reviewBindings.push(payload.sourceName ?? "");
  }

  if (reviewQueueColumns.has("source_url")) {
    reviewAssignments.push("source_url = ?");
    reviewBindings.push(payload.sourceUrl ?? "");
  }

  if (reviewQueueColumns.has("ai_summary")) {
    reviewAssignments.push("ai_summary = ?");
    reviewBindings.push(payload.summary ?? "");
  }

  if (reviewQueueColumns.has("review_status")) {
    reviewAssignments.push("review_status = ?");
    reviewBindings.push(status === "published" ? "approved" : "pending");
  }

  if (reviewQueueColumns.has("reviewed_at")) {
    reviewAssignments.push("reviewed_at = ?");
    reviewBindings.push(status === "published" ? timestamp : null);
  }

  if (reviewQueueColumns.has("updated_at")) {
    reviewAssignments.push("updated_at = ?");
    reviewBindings.push(timestamp);
  }

  if (reviewAssignments.length === 0) {
    return;
  }

  reviewBindings.push(postId);
  await exec(
    db,
    `UPDATE review_queue
     SET ${reviewAssignments.join(", ")}
     WHERE entity_type = 'post' AND entity_id = ?`,
    reviewBindings
  );
}

export async function savePost(db: D1Database, payload: SavePostPayload) {
  const timestamp = nowIso();
  const current = payload.currentSlug
    ? await first<SqlRow>(db, "SELECT * FROM posts WHERE slug = ?", [payload.currentSlug])
    : null;
  const postColumns = await getTableColumns(db, "posts");
  const hasSourceNoteColumn = postColumns.has("source_note");
  const hasReviewFeedbackColumn = postColumns.has("review_feedback");
  const hasRelatedToolSlugsColumn = postColumns.has("related_tool_slugs_json");
  const slug = await uniqueSlug(
    db,
    "posts",
    slugify(payload.slug || payload.title || ""),
    current ? String(current.slug) : undefined
  );
  const id = current ? String(current.id) : makeId("post");
  const status = payload.status === "published" ? "published" : "draft";
  const publishedAt = status === "published" ? (current?.published_at ? String(current.published_at) : timestamp) : null;
  const insertColumns = [
    "id",
    "slug",
    "title",
    "summary",
    "content",
    "category",
    "tags_json",
    "status",
    "source_name",
    "source_url",
    "editor_note",
    "featured",
    "created_at",
    "updated_at",
    "published_at"
  ];
  const insertValues: unknown[] = [
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
    payload.editorNote ?? "",
    payload.featured ? 1 : 0,
    current?.created_at ? String(current.created_at) : timestamp,
    timestamp,
    publishedAt
  ];

  if (hasSourceNoteColumn) {
    insertColumns.splice(10, 0, "source_note");
    insertValues.splice(10, 0, payload.sourceNote ?? "");
  }

  if (hasReviewFeedbackColumn) {
    const insertIndex = hasSourceNoteColumn ? 11 : 10;
    insertColumns.splice(insertIndex, 0, "review_feedback");
    insertValues.splice(insertIndex, 0, payload.reviewFeedback ?? "");
  }

  if (hasRelatedToolSlugsColumn) {
    const insertIndex = 11 + Number(hasSourceNoteColumn) + Number(hasReviewFeedbackColumn);
    insertColumns.splice(insertIndex, 0, "related_tool_slugs_json");
    insertValues.splice(insertIndex, 0, JSON.stringify(payload.relatedToolSlugs ?? []));
  }

  const updateAssignments = [
    "slug = excluded.slug",
    "title = excluded.title",
    "summary = excluded.summary",
    "content = excluded.content",
    "category = excluded.category",
    "tags_json = excluded.tags_json",
    "status = excluded.status",
    "source_name = excluded.source_name",
    "source_url = excluded.source_url",
    "editor_note = excluded.editor_note",
    "featured = excluded.featured",
    "updated_at = excluded.updated_at",
    "published_at = excluded.published_at"
  ];

  if (hasSourceNoteColumn) {
    updateAssignments.splice(9, 0, "source_note = excluded.source_note");
  }

  if (hasReviewFeedbackColumn) {
    updateAssignments.splice(9 + Number(hasSourceNoteColumn), 0, "review_feedback = excluded.review_feedback");
  }

  if (hasRelatedToolSlugsColumn) {
    updateAssignments.splice(
      10 + Number(hasSourceNoteColumn) + Number(hasReviewFeedbackColumn),
      0,
      "related_tool_slugs_json = excluded.related_tool_slugs_json"
    );
  }

  await exec(
    db,
    `INSERT INTO posts (${insertColumns.join(", ")})
     VALUES (${insertColumns.map(() => "?").join(", ")})
     ON CONFLICT(id) DO UPDATE SET ${updateAssignments.join(", ")}`,
    insertValues
  );

  try {
    await syncReviewQueueForPost(db, payload, id, slug, status, timestamp);
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        scope: "posts",
        event: "review_queue_sync_failed",
        timestamp,
        postId: id,
        slug,
        error: error instanceof Error ? error.message : String(error)
      })
    );
  }

  return first<SqlRow>(db, "SELECT * FROM posts WHERE id = ?", [id]);
}

export async function deletePostBySlug(db: D1Database, slug: string) {
  const post = await first<SqlRow>(db, "SELECT status FROM posts WHERE slug = ?", [slug]);

  if (!post) {
    return { ok: true as const };
  }

  if (String(post.status) === "published") {
    return {
      ok: false as const,
      status: 400,
      error: "已发布的文章不允许删除，请先撤回为草稿状态。"
    };
  }

  await exec(db, "DELETE FROM posts WHERE slug = ?", [slug]);
  return { ok: true as const };
}
