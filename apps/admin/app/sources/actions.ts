"use server";

import { redirect } from "next/navigation";
import { createSource, updateSourceStatus } from "@devtoollab/shared/api-client";
import type { SourceRecord } from "@devtoollab/shared";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createSourceAction(formData: FormData) {
  await createSource({
    name: text(formData, "name"),
    slug: text(formData, "slug") || undefined,
    type: text(formData, "type"),
    baseUrl: text(formData, "baseUrl"),
    feedUrl: text(formData, "feedUrl"),
    status: (text(formData, "status") || "active") as SourceRecord["status"],
    enabled: formData.has("enabled"),
    crawlIntervalMinutes: Number(text(formData, "crawlIntervalMinutes") || "60"),
    parserKey: text(formData, "parserKey"),
    notes: text(formData, "notes")
  });

  redirect("/sources");
}

export async function updateSourceStatusAction(formData: FormData) {
  await updateSourceStatus(
    text(formData, "id"),
    text(formData, "status") as SourceRecord["status"]
  );

  redirect("/sources");
}
