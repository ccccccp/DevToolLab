"use server";

import { redirect } from "next/navigation";
import { deletePostById, savePost, splitTags } from "@devtoollab/shared/api-client";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function savePostAction(formData: FormData) {
  const currentId = text(formData, "currentId") || undefined;
  const slug = text(formData, "slug");
  const post = await savePost({
    id: currentId,
    currentSlug: text(formData, "currentSlug") || undefined,
    slug: slug || undefined,
    title: text(formData, "title"),
    summary: text(formData, "summary"),
    content: text(formData, "content"),
    category: text(formData, "category"),
    tags: splitTags(text(formData, "tags")),
    status: text(formData, "status") === "published" ? "published" : "draft",
    sourceName: text(formData, "sourceName"),
    sourceUrl: text(formData, "sourceUrl"),
    sourceNote: text(formData, "sourceNote"),
    reviewFeedback: text(formData, "reviewFeedback"),
    editorNote: text(formData, "editorNote"),
    relatedToolSlugs: splitTags(text(formData, "relatedToolSlugs")),
    featured: formData.has("featured")
  });

  redirect(`/posts/${encodeURIComponent(post.id)}`);
}

export async function deletePostAction(formData: FormData) {
  await deletePostById(text(formData, "id"));
  redirect("/posts");
}
