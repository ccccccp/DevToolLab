import { notFound } from "next/navigation";
import { getToolBySlug } from "@devtoollab/shared/api-client";
import { deleteToolAction, saveToolAction } from "../actions";

type ToolEditorPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function ToolEditorPage({ params }: ToolEditorPageProps) {
  const { slug } = await params;
  const tool = await getToolBySlug(slug);

  if (!tool) {
    notFound();
  }

  return (
    <section className="admin-section">
      <div className="section-header">
        <div>
          <span className="eyebrow">编辑工具</span>
          <h1>{tool.name}</h1>
          <p className="muted">修改后，前台工具页和关联文章会读取最新数据。</p>
        </div>
      </div>

      <form action={saveToolAction} className="editor-form">
        <input type="hidden" name="currentSlug" value={tool.slug} />

        <div className="field-grid">
          <label className="field">
            <span>名称</span>
            <input name="name" defaultValue={tool.name} required />
          </label>
          <label className="field">
            <span>Slug</span>
            <input name="slug" defaultValue={tool.slug} />
          </label>
          <label className="field">
            <span>分类</span>
            <input name="category" defaultValue={tool.category} required />
          </label>
          <label className="field">
            <span>状态</span>
            <select name="status" defaultValue={tool.status}>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
            </select>
          </label>
        </div>

        <div className="field-grid">
          <label className="field">
            <span>定价</span>
            <input name="pricing" defaultValue={tool.pricing} required />
          </label>
          <label className="field">
            <span>官网</span>
            <input name="website" type="url" defaultValue={tool.website} required />
          </label>
          <label className="field">
            <span>标签</span>
            <input name="tags" defaultValue={tool.tags.join(",")} />
          </label>
        </div>

        <label className="field">
          <span>摘要</span>
          <textarea name="summary" rows={3} defaultValue={tool.summary} required />
        </label>

        <label className="field">
          <span>描述</span>
          <textarea name="description" rows={8} defaultValue={tool.description} required />
        </label>

        <label className="checkbox-field">
          <input type="checkbox" name="featured" defaultChecked={tool.featured} />
          <span>加入首页推荐</span>
        </label>

        <div className="actions-row">
          <button type="submit" className="button primary-button">
            保存修改
          </button>
        </div>
      </form>

      <form action={deleteToolAction} className="danger-form">
        <input type="hidden" name="slug" value={tool.slug} />
        <button type="submit" className="button danger-button">
          删除工具
        </button>
      </form>
    </section>
  );
}
