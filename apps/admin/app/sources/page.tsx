import { listSources } from "@devtoollab/shared/api-client";
import { saveSourceAction, updateSourceStatusAction } from "./actions";
import { EditSourceDialog } from "./edit-source-dialog";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const sources = await listSources();

  return (
    <section className="admin-section">
      <div className="section-header">
        <div>
          <span className="eyebrow">采集源</span>
          <h1>真实来源管理：目标、频率、状态、解析器</h1>
          <p className="muted">这里的数据来自 D1，可直接作为后续抓取调度的基础。</p>
        </div>
      </div>

      <form action={saveSourceAction} className="editor-form">
        <div className="field-grid">
          <label className="field">
            <span>来源名称</span>
            <input name="name" placeholder="例如：Product Hunt" required />
          </label>
          <label className="field">
            <span>Slug</span>
            <input name="slug" placeholder="可留空自动生成" />
          </label>
          <label className="field">
            <span>类型</span>
            <select name="type" required>
              <option value="news">新闻资讯 (news)</option>
              <option value="tool-directory">工具目录 (tool-directory)</option>
              <option value="official-blog">官方博客 (official-blog)</option>
              <option value="product-launch">新产品发布 (product-launch)</option>
            </select>
          </label>
          <label className="field">
            <span>状态</span>
            <select name="status" defaultValue="active">
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="error">error</option>
            </select>
          </label>
        </div>

        <div className="field-grid">
          <label className="field">
            <span>基础地址</span>
            <input name="baseUrl" type="url" placeholder="https://example.com" required />
          </label>
          <label className="field">
            <span>Feed 地址</span>
            <input name="feedUrl" placeholder="可为空" />
          </label>
          <label className="field">
            <span>抓取频率（分钟）</span>
            <input name="crawlIntervalMinutes" type="number" min="5" defaultValue="60" required />
          </label>
          <label className="field">
            <span>解析器 Key</span>
            <select name="parserKey" required>
              <option value="rss-standard">标准 RSS (rss-standard)</option>
              <option value="product-hunt">Product Hunt RSS (product-hunt)</option>
              <option value="hn-top">Hacker News API (hn-top)</option>
              <option value="anthropic-newsroom">Anthropic Newsroom (custom)</option>
            </select>
          </label>
        </div>

        <label className="field">
          <span>备注</span>
          <textarea name="notes" rows={3} />
        </label>

        <label className="checkbox-field">
          <input type="checkbox" name="enabled" defaultChecked />
          <span>启用该来源</span>
        </label>

        <div className="actions-row">
          <button type="submit" className="button primary-button">
            保存来源
          </button>
        </div>
      </form>

      <div className="list-grid">
        {sources.map((source) => (
          <article className="card compact-card" key={source.id}>
            <div className="badge-row">
              <span className={`status ${source.status}`}>{source.status}</span>
              {source.enabled ? <span className="status featured">enabled</span> : null}
            </div>
            <h3>{source.name}</h3>
            <p className="muted">{source.baseUrl}</p>
            <p className="meta-line">类型：{source.type}</p>
            <p className="meta-line">频率：每 {source.crawlIntervalMinutes} 分钟</p>
            <p className="meta-line">解析器：{source.parserKey}</p>
            <p className="meta-line">
              最近抓取：{source.lastCrawledAt ? new Date(source.lastCrawledAt).toLocaleString("zh-CN") : "暂无"}
            </p>
            <form action={updateSourceStatusAction} className="inline-form">
              <input type="hidden" name="id" value={source.id} />
              <input type="hidden" name="status" value={source.status === "active" ? "paused" : "active"} />
              <button type="submit" className="button">
                {source.status === "active" ? "暂停" : "启用"}
              </button>
            </form>
            <EditSourceDialog source={source} />
          </article>
        ))}
      </div>
    </section>
  );
}
