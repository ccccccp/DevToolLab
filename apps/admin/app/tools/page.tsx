import Link from "next/link";
import { listTools } from "@devtoollab/shared/api-client";

export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  const tools = await listTools("all");

  return (
    <section className="admin-section">
      <div className="section-header">
        <div>
          <span className="eyebrow">工具管理</span>
          <h1>维护工具实体，而不是把工具埋在文章里</h1>
          <p className="muted">工具记录也已经迁到 D1，前台详情页直接复用这些字段。</p>
        </div>
        <Link href="/tools/new" className="button primary-button">
          新建工具
        </Link>
      </div>

      <div className="list-grid">
        {tools.map((tool) => (
          <article className="card compact-card" key={tool.id}>
            <div className="badge-row">
              <span className={`status ${tool.status}`}>{tool.status === "published" ? "已发布" : "草稿"}</span>
              {tool.featured ? <span className="status featured">推荐</span> : null}
            </div>
            <h3>{tool.name}</h3>
            <p className="muted">{tool.summary}</p>
            <p className="meta-line">分类：{tool.category}</p>
            <p className="meta-line">定价：{tool.pricing}</p>
            <Link href={`/tools/${tool.slug}`} className="text-link">
              编辑工具
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
