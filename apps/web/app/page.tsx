import Link from "next/link";
import { pipelineStages, siteMeta } from "@devtoollab/shared";
import { listPosts, listTools } from "@devtoollab/shared/api-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const posts = await listPosts("published");
  const tools = await listTools("published");
  const heroPost = posts.find((post) => post.featured) ?? posts[0];
  const featuredTools = tools.filter((tool) => tool.featured).slice(0, 3);
  const latestPosts = posts.slice(0, 4);

  return (
    <>
      <section className="hero">
        <div className="panel hero-main">
          <span className="eyebrow">AI 内容站 + 工具站</span>
          <h1>把热点内容、工具实体和最小 CMS 先接成一条能跑的线。</h1>
          <p>
            {siteMeta.description}
            现在前台和后台已经读写同一份内容数据，适合先把内容生产闭环跑起来。
          </p>
          {heroPost ? (
            <div className="feature-strip">
              <span className="feature-label">今日推荐</span>
              <Link href={`/news/${heroPost.id}`}>{heroPost.title}</Link>
            </div>
          ) : null}
          <div className="cta-row">
            <Link href="/news" className="button primary">
              浏览文章
            </Link>
            <Link href="/tools" className="button secondary">
              浏览工具
            </Link>
          </div>
        </div>
        <div className="stack">
          <div className="mini-stat panel">
            <strong>{posts.length}</strong>
            <span className="muted">当前已发布文章</span>
          </div>
          <div className="mini-stat panel">
            <strong>{tools.length}</strong>
            <span className="muted">当前已发布工具</span>
          </div>
          <div className="mini-stat panel">
            <strong>{pipelineStages.length}</strong>
            <span className="muted">内容流水线核心阶段</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">专题导读</span>
            <h2>这不是单纯的博客首页，而是内容和工具的联合入口</h2>
            <p>文章负责拉新，工具页负责承接，后台负责提效。</p>
          </div>
        </div>
        <div className="info-grid">
          <article className="card feature-card">
            <h3>内容站</h3>
            <p className="meta">承接 AI 热点、方法论、专题和结构化文章详情。</p>
          </article>
          <article className="card feature-card">
            <h3>工具站</h3>
            <p className="meta">工具作为独立实体存在，后续可扩展到榜单、对比和聚合导航。</p>
          </article>
          <article className="card feature-card">
            <h3>轻 CMS</h3>
            <p className="meta">现在已经可以通过后台新增和编辑文章、工具，并立即反映到前台。</p>
          </article>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">最新文章</span>
            <h2>从热点内容拉新，再把流量导入工具页</h2>
            <p>优先维护已发布文章，草稿在后台继续迭代。</p>
          </div>
          <Link href="/news" className="button secondary">
            查看全部
          </Link>
        </div>
        <div className="grid">
          {latestPosts.map((post) => (
            <article key={post.id} className="card">
              <span className="eyebrow">{post.category}</span>
              <h3>{post.title}</h3>
              <p className="meta">{post.summary}</p>
              <div className="meta-line">{new Date(post.publishedAt ?? post.updatedAt).toLocaleDateString("zh-CN")}</div>
              <div>
                {post.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="cta-row">
                <Link href={`/news/${post.id}`} className="button secondary">
                  阅读文章
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">推荐工具</span>
            <h2>工具页是站点的长期资产，不是文章附属品</h2>
            <p>把分类、定价、官网和标签做成结构化字段，后续扩榜单和对比会轻很多。</p>
          </div>
          <Link href="/tools" className="button secondary">
            查看工具
          </Link>
        </div>
        <div className="grid">
          {featuredTools.map((tool) => (
            <article key={tool.slug} className="card">
              <span className="eyebrow">{tool.pricing}</span>
              <h3>{tool.name}</h3>
              <p className="meta">{tool.summary}</p>
              <div className="meta-line">{tool.category}</div>
              <div>
                {tool.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="cta-row">
                <Link href={`/tools/${tool.slug}`} className="button secondary">
                  查看详情
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">流水线</span>
            <h2>后续内容生产会沿这条链路扩展</h2>
          </div>
        </div>
        <div className="timeline">
          {pipelineStages.map((stage, index) => (
            <article key={stage.key} className="card timeline-card">
              <strong>0{index + 1}</strong>
              <h3>{stage.label}</h3>
              <p className="meta">{stage.description}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
