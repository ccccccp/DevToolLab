import Link from "next/link";
import { notFound } from "next/navigation";
import { getToolBySlug, listPosts } from "@devtoollab/shared/api-client";

type ToolDetailProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function ToolDetailPage({ params }: ToolDetailProps) {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);

  if (!tool || tool.status !== "published") {
    notFound();
  }

  const relatedPosts = (await listPosts("published")).filter((post) =>
    post.relatedToolSlugs.includes(tool.slug)
  );

  return (
    <section className="detail-page section">
      <article className="detail-main panel">
        <span className="eyebrow">{tool.pricing}</span>
        <h1>{tool.name}</h1>
        <p className="meta intro">{tool.summary}</p>
        <div className="detail-meta">
          <span>分类：{tool.category}</span>
          <span>状态：已发布</span>
        </div>
        <div className="tag-row">
          {tool.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
        <div className="rich-content" style={{ whiteSpace: "pre-wrap" }}>
          {tool.description}
        </div>
      </article>

      <aside className="detail-side stack">
        <article className="panel side-block">
          <span className="eyebrow">官网链接</span>
          <h3>工具入口</h3>
          <a href={tool.website} target="_blank" rel="noreferrer" className="button secondary">
            打开官网
          </a>
        </article>

        <article className="panel side-block">
          <span className="eyebrow">适合人群</span>
          <p className="meta">这类工具页后续可以继续扩展截图、优缺点、适用人群和对比模块。</p>
        </article>

        <article className="panel side-block">
          <span className="eyebrow">相关文章</span>
          {relatedPosts.length > 0 ? (
            <div className="stack compact-stack">
              {relatedPosts.map((post) => (
                <Link href={`/news/${post.id}`} key={post.id} className="related-link">
                  <strong>{post.title}</strong>
                  <span className="meta">{post.summary}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="meta">暂无关联文章。</p>
          )}
        </article>
      </aside>
    </section>
  );
}
