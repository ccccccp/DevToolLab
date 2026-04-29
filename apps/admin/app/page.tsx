import Link from "next/link";
import { adminSections, pipelineStages } from "@devtoollab/shared";
import { getDashboardStats, listPosts, listTools } from "@devtoollab/shared/api-client";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const stats = await getDashboardStats();
  const recentPosts = (await listPosts("all")).slice(0, 3);
  const recentTools = (await listTools("all")).slice(0, 3);

  return (
    <>
      <section className="hero">
        <span className="eyebrow">运营后台</span>
        <h1>先把最小 CMS 和 D1 数据闭环跑通，再扩成完整内容流水线。</h1>
        <p className="muted">现在前台和后台都通过 Worker API 访问 D1，数据入口已经统一。</p>
      </section>

      <section className="stat-grid">
        <article className="card stat-card">
          <span className="eyebrow">Posts</span>
          <strong>{stats.posts}</strong>
          <p className="muted">
            {stats.publishedPosts} 已发布 / {stats.draftPosts} 草稿
          </p>
        </article>
        <article className="card stat-card">
          <span className="eyebrow">Tools</span>
          <strong>{stats.tools}</strong>
          <p className="muted">
            {stats.publishedTools} 已发布 / {stats.featuredTools} 推荐
          </p>
        </article>
        <article className="card stat-card">
          <span className="eyebrow">Ops</span>
          <strong>{stats.sources}</strong>
          <p className="muted">
            {stats.activeSources} 活跃来源 / {stats.pendingReviews} 待审核
          </p>
        </article>
        <article className="card stat-card">
          <span className="eyebrow">Pipeline</span>
          <strong>{pipelineStages.length}</strong>
          <p className="muted">{stats.crawlTasks} 条抓取任务记录</p>
        </article>
      </section>

      <section className="grid">
        {adminSections.map((section) => (
          <article className="card" key={section.slug}>
            <span className="eyebrow">{section.slug.toUpperCase()}</span>
            <h3>{section.label}</h3>
            <p className="muted">{section.description}</p>
            <Link href={section.href} className="button">
              进入模块
            </Link>
          </article>
        ))}
      </section>

      <section className="admin-section">
        <div className="section-header">
          <div>
            <span className="eyebrow">最近文章</span>
            <h2>已接入 D1 的文章记录</h2>
          </div>
          <Link href="/posts" className="button">
            管理文章
          </Link>
        </div>
        <div className="list-grid">
          {recentPosts.map((post) => (
            <article className="card compact-card" key={post.id}>
              <div className="badge-row">
                <span className={`status ${post.status}`}>
                  {post.status === "published" ? "已发布" : "草稿"}
                </span>
                {post.featured ? <span className="status featured">推荐</span> : null}
              </div>
              <h3>{post.title}</h3>
              <p className="muted">{post.summary}</p>
              <Link href={`/posts/${post.id}`} className="text-link">
                编辑内容
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section">
        <div className="section-header">
          <div>
            <span className="eyebrow">最近工具</span>
            <h2>工具实体由 D1 统一承载</h2>
          </div>
          <Link href="/tools" className="button">
            管理工具
          </Link>
        </div>
        <div className="list-grid">
          {recentTools.map((tool) => (
            <article className="card compact-card" key={tool.id}>
              <div className="badge-row">
                <span className={`status ${tool.status}`}>
                  {tool.status === "published" ? "已发布" : "草稿"}
                </span>
                {tool.featured ? <span className="status featured">推荐</span> : null}
              </div>
              <h3>{tool.name}</h3>
              <p className="muted">{tool.summary}</p>
              <Link href={`/tools/${tool.slug}`} className="text-link">
                编辑工具
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
