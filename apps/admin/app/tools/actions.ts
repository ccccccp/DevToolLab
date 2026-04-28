"use server";

import { redirect } from "next/navigation";
import { deleteTool, saveTool, splitTags } from "@devtoollab/shared/api-client";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function saveToolAction(formData: FormData) {
  const slug = text(formData, "slug");
  const tool = await saveTool({
    currentSlug: text(formData, "currentSlug") || undefined,
    slug: slug || undefined,
    name: text(formData, "name"),
    summary: text(formData, "summary"),
    description: text(formData, "description"),
    category: text(formData, "category"),
    pricing: text(formData, "pricing"),
    website: text(formData, "website"),
    tags: splitTags(text(formData, "tags")),
    status: text(formData, "status") === "published" ? "published" : "draft",
    featured: formData.has("featured")
  });

  redirect(`/tools/${encodeURIComponent(tool.slug)}`);
}

export async function deleteToolAction(formData: FormData) {
  await deleteTool(text(formData, "slug"));
  redirect("/tools");
}
