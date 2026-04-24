import { saveToolAction } from "../actions";

export default function NewToolPage() {
  return (
    <section className="admin-section">
      <div className="section-header">
        <div>
          <span className="eyebrow">新建工具</span>
          <h1>录入一个工具实体</h1>
          <p className="muted">这样后面才能继续做工具详情页、榜单页和对比页。</p>
        </div>
      </div>

      <form action={saveToolAction} className="editor-form">
        <div className="field-grid">
          <label className="field">
            <span>名称</span>
            <input name="name" placeholder="例如：Perplexity" required />
          </label>
          <label className="field">
            <span>Slug</span>
            <input name="slug" placeholder="可留空自动生成" />
          </label>
          <label className="field">
            <span>分类</span>
            <input name="category" placeholder="Search / Coding / Research" required />
          </label>
          <label className="field">
            <span>状态</span>
            <select name="status" defaultValue="draft">
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
            </select>
          </label>
        </div>

        <div className="field-grid">
          <label className="field">
            <span>定价</span>
            <input name="pricing" placeholder="Freemium / Paid / Free" required />
          </label>
          <label className="field">
            <span>官网</span>
            <input name="website" type="url" placeholder="https://example.com" required />
          </label>
          <label className="field">
            <span>标签</span>
            <input name="tags" placeholder="例如：搜索,问答,来源引用" />
          </label>
        </div>

        <label className="field">
          <span>摘要</span>
          <textarea name="summary" rows={3} required />
        </label>

        <label className="field">
          <span>描述</span>
          <textarea name="description" rows={8} required />
        </label>

        <label className="checkbox-field">
          <input type="checkbox" name="featured" />
          <span>加入首页推荐</span>
        </label>

        <div className="actions-row">
          <button type="submit" className="button primary-button">
            保存工具
          </button>
        </div>
      </form>
    </section>
  );
}
