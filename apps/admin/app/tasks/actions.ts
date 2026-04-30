"use server";

import { redirect } from "next/navigation";
import {
  createCrawlTask,
  createReviewItem,
  deleteReviewItem,
  runCrawlTask,
  updateCrawlTaskStatus,
  updateReviewStatus
} from "@devtoollab/shared/api-client";
import type { CrawlRunMode, CrawlTaskRecord, CrawlTaskType, ReviewQueueItem } from "@devtoollab/shared";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createCrawlTaskAction(formData: FormData) {
  await createCrawlTask({
    sourceId: text(formData, "sourceId") || undefined,
    title: text(formData, "title"),
    taskType: text(formData, "taskType") as CrawlTaskType,
    runMode: text(formData, "runMode") as CrawlRunMode,
    targetUrl: text(formData, "targetUrl"),
    summary: text(formData, "summary")
  });

  redirect("/tasks");
}

export async function updateCrawlTaskStatusAction(formData: FormData) {
  await updateCrawlTaskStatus(
    text(formData, "id"),
    text(formData, "status") as CrawlTaskRecord["status"]
  );

  redirect("/tasks");
}

export async function runCrawlTaskAction(formData: FormData) {
  await runCrawlTask(text(formData, "id"));
  redirect("/tasks");
}

export async function runCrawlTaskDirectAction(id: string) {
  return runCrawlTask(id);
}

export async function createReviewItemAction(formData: FormData) {
  await createReviewItem({
    entityType: text(formData, "entityType") as ReviewQueueItem["entityType"],
    entityId: text(formData, "entityId"),
    entitySlug: text(formData, "entitySlug"),
    title: text(formData, "title"),
    sourceName: text(formData, "sourceName"),
    sourceUrl: text(formData, "sourceUrl"),
    aiSummary: text(formData, "aiSummary"),
    editorNote: text(formData, "editorNote"),
    priority: Number(text(formData, "priority") || "3")
  });

  redirect("/tasks");
}

export async function updateReviewStatusAction(formData: FormData) {
  await updateReviewStatus(
    text(formData, "id"),
    text(formData, "reviewStatus") as ReviewQueueItem["reviewStatus"],
    text(formData, "editorNote")
  );

  redirect("/tasks");
}

export async function deleteReviewItemAction(formData: FormData) {
  await deleteReviewItem(text(formData, "id"));
  redirect("/tasks/reviews");
}

export async function bulkDeleteReviewItemsAction(formData: FormData) {
  const ids = formData
    .getAll("ids")
    .map((id) => String(id).trim())
    .filter(Boolean);

  await Promise.all(ids.map((id) => deleteReviewItem(id)));
  redirect("/tasks/reviews");
}
