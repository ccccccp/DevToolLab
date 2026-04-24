import { savePostAction } from "../actions";

export default function NewPostPage() {
  return (
    <section className="admin-section">
      <div className="section-header">
        <div>
          <span className="eyebrow">新建文章</span>
          <h1>录入一篇可发布文章</h1>
          <p className="muted">Slug 留空时会根据标题自动生成，来源说明用于发布前标记采集背景和核验要求。</p>
        </div>
      </div>

      <form action={savePostAction} className="editor-form">
        <div className="field-grid">
          <label className="field">
            <span>标题</span>
            <input name="title" placeholder="例如：某个 AI 产品更新值得关注吗" required />
          </label>
          <label className="field">
            <span>Slug</span>
            <input name="slug" placeholder="可留空自动生成" />
          </label>
          <label className="field">
            <span>分类</span>
            <input name="category" placeholder="News / Agents / Research" required />
          </label>
          <label className="field">
            <span>状态</span>
            <select name="status" defaultValue="draft">
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
            </select>
          </label>
        </div>

        <label className="field">
          <span>摘要</span>
          <textarea name="summary" rows={3} required />
        </label>

        <label className="field">
          <span>正文</span>
          <textarea name="content" rows={12} required />
        </label>

        <div className="field-grid">
          <label className="field">
            <span>来源名称</span>
            <input name="sourceName" placeholder="例如：OpenAI News" required />
          </label>
          <label className="field">
            <span>来源链接</span>
            <input name="sourceUrl" type="url" placeholder="https://example.com/source" required />
          </label>
          <label className="field">
            <span>标签</span>
            <input name="tags" placeholder="用英文逗号分隔，例如：OpenAI,发布,图片生成" />
          </label>
          <label className="field">
            <span>关联工具 Slug</span>
            <input name="relatedToolSlugs" placeholder="例如：cursor,notebooklm" />
          </label>
        </div>

        <label className="field">
          <span>来源说明</span>
          <textarea
            name="sourceNote"
            rows={3}
            placeholder="例如：抓取自官方博客，发布前需要核对发布时间、功能范围和地区可用性。"
          />
        </label>

        <label className="field">
          <span>审核反馈</span>
          <textarea
            name="reviewFeedback"
            rows={3}
            placeholder="留空即可，打回修改时系统会自动回填。"
          />
        </label>

        <label className="field">
          <span>编辑点评</span>
          <textarea name="editorNote" rows={4} />
        </label>

        <label className="checkbox-field">
          <input type="checkbox" name="featured" />
          <span>加入首页推荐</span>
        </label>

        <div className="actions-row">
          <button type="submit" className="button primary-button">
            保存文章
          </button>
        </div>
      </form>
    </section>
  );
}
