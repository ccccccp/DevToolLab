import Link from "next/link";
import { notFound } from "next/navigation";
import { getPostBySlug, listTools } from "@devtoollab/shared/api-client";
import { MarkdownContent } from "../../../components/markdown-content";

type NewsDetailProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function NewsDetailPage({ params }: NewsDetailProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post || post.status !== "published") {
    notFound();
  }

  const relatedTools = (await listTools("published")).filter((tool) =>
    post.relatedToolSlugs.includes(tool.slug)
  );

  return (
    <section className="detail-page section">
      <article className="detail-main panel">
        <span className="eyebrow">{post.category}</span>
        <h1>{post.title}</h1>
        <p className="meta intro">{post.summary}</p>
        <div className="detail-meta">
          <span>发布时间：{new Date(post.publishedAt ?? post.updatedAt).toLocaleString("zh-CN")}</span>
          <span>来源：{post.sourceName}</span>
        </div>
        <div className="tag-row">
          {post.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
        <MarkdownContent content={post.content} className="rich-content" />
      </article>

      <aside className="detail-side stack">
        <article className="panel side-block">
          <span className="eyebrow">来源信息</span>
          <h3>原文入口</h3>
          <p className="meta">发布前保留来源和核验说明，能让内容质量和可追溯性更稳。</p>
          {post.sourceNote ? <p className="meta">{post.sourceNote}</p> : null}
          <a href={post.sourceUrl} target="_blank" rel="noreferrer" className="button secondary">
            打开原文
          </a>
        </article>

        <article className="panel side-block">
          <span className="eyebrow">编辑点评</span>
          <p className="meta">{post.editorNote || "暂无编辑点评。"}</p>
        </article>

        <article className="panel side-block">
          <span className="eyebrow">相关工具</span>
          {relatedTools.length > 0 ? (
            <div className="stack compact-stack">
              {relatedTools.map((tool) => (
                <Link href={`/tools/${tool.slug}`} key={tool.slug} className="related-link">
                  <strong>{tool.name}</strong>
                  <span className="meta">{tool.summary}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="meta">暂未关联工具。</p>
          )}
        </article>
      </aside>
    </section>
  );
}
