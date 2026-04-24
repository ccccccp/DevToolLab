import Link from "next/link";
import { listPosts } from "@devtoollab/shared/api-client";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const posts = await listPosts("published");

  return (
    <section className="list-page section">
      <div className="section-head">
        <div>
          <span className="eyebrow">文章列表</span>
          <h1>围绕 AI 热点、方法论和工作流搭内容层</h1>
          <p>文章详情页会继续承接来源、编辑点评、相关工具和结构化信息。</p>
        </div>
      </div>
      <div className="grid">
        {posts.map((post) => (
          <article key={post.slug} className="card">
            <div className="card-head">
              <span className="eyebrow">{post.category}</span>
              {post.featured ? <span className="tag strong-tag">推荐</span> : null}
            </div>
            <h3>{post.title}</h3>
            <p className="meta">{post.summary}</p>
            <div className="meta-line">
              发布时间：{new Date(post.publishedAt ?? post.updatedAt).toLocaleString("zh-CN")}
            </div>
            <div>
              {post.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
            <div className="cta-row">
              <Link href={`/news/${post.slug}`} className="button secondary">
                打开文章
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
