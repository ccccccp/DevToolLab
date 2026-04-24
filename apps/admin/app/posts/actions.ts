"use server";

import { redirect } from "next/navigation";
import { deletePost, savePost, splitTags } from "@devtoollab/shared/api-client";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function savePostAction(formData: FormData) {
  const slug = text(formData, "slug");
  const post = await savePost({
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

  redirect(`/posts/${post.slug}`);
}

export async function deletePostAction(formData: FormData) {
  await deletePost(text(formData, "slug"));
  redirect("/posts");
}
