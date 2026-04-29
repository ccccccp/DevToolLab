import Link from "next/link";
import type { ToolRecord } from "@devtoollab/shared";
import { listTools } from "@devtoollab/shared/api-client";

export const dynamic = "force-dynamic";

export default async function ToolsPage() {
  const apiBaseUrl = process.env.DEVTOOLLAB_API_BASE_URL?.trim() || "";
  let tools: ToolRecord[] = [];

  try {
    tools = await listTools("published");
  } catch (error) {
    console.error(
      JSON.stringify({
        scope: "web-tools",
        event: "ssr_fetch_failed",
        apiBaseUrl,
        error: error instanceof Error ? error.message : String(error)
      })
    );
  }

  return (
    <section className="list-page section">
      <div className="section-head">
        <div>
          <span className="eyebrow">工具列表</span>
          <h1>把工具做成结构化实体，后面才能接榜单和对比</h1>
          <p>现在已经支持摘要、描述、官网、定价、分类和标签字段。</p>
        </div>
      </div>
      <div className="grid">
        {tools.map((tool) => (
          <article key={tool.slug} className="card">
            <div className="card-head">
              <span className="eyebrow">{tool.pricing}</span>
              {tool.featured ? <span className="tag strong-tag">推荐</span> : null}
            </div>
            <h3>{tool.name}</h3>
            <p className="meta">{tool.summary}</p>
            <div className="meta-line">分类：{tool.category}</div>
            <div>
              {tool.tags.map((tag: string) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
            <div className="cta-row">
              <Link href={`/tools/${tool.slug}`} className="button secondary">
                打开工具页
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
