import { listPosts } from "@devtoollab/shared/api-client";
import { PostsBoard } from "./posts-board";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  const posts = await listPosts("all");

  return (
    <section className="admin-section">
      <PostsBoard posts={posts} />
    </section>
  );
}
