import { notFound } from "next/navigation";
import { getPostBySlug } from "@devtoollab/shared/api-client";
import { deletePostAction, savePostAction } from "../actions";

type PostEditorPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function PostEditorPage({ params }: PostEditorPageProps) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  return (
    <section className="admin-section">
      <div className="section-header">
        <div>
          <span className="eyebrow">编辑文章</span>
          <h1>{post.title}</h1>
          <p className="muted">发布前可以在这里修改标题、摘要、标签和来源说明，保存后审核队列会同步最新信息。</p>
        </div>
      </div>

      <form action={savePostAction} className="editor-form">
        <input type="hidden" name="currentSlug" value={post.slug} />

        <div className="field-grid">
          <label className="field">
            <span>标题</span>
            <input name="title" defaultValue={post.title} required />
          </label>
          <label className="field">
            <span>Slug</span>
            <input name="slug" defaultValue={post.slug} />
          </label>
          <label className="field">
            <span>分类</span>
            <input name="category" defaultValue={post.category} required />
          </label>
          <label className="field">
            <span>状态</span>
            <select name="status" defaultValue={post.status}>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
            </select>
          </label>
        </div>

        <label className="field">
          <span>摘要</span>
          <textarea name="summary" rows={3} defaultValue={post.summary} required />
        </label>

        <label className="field">
          <span>正文</span>
          <textarea name="content" rows={12} defaultValue={post.content} required />
        </label>

        <div className="field-grid">
          <label className="field">
            <span>来源名称</span>
            <input name="sourceName" defaultValue={post.sourceName} required />
          </label>
          <label className="field">
            <span>来源链接</span>
            <input name="sourceUrl" type="url" defaultValue={post.sourceUrl} required />
          </label>
          <label className="field">
            <span>标签</span>
            <input name="tags" defaultValue={post.tags.join(",")} />
          </label>
          <label className="field">
            <span>关联工具 Slug</span>
            <input name="relatedToolSlugs" defaultValue={post.relatedToolSlugs.join(",")} />
          </label>
        </div>

        <label className="field">
          <span>来源说明</span>
          <textarea name="sourceNote" rows={3} defaultValue={post.sourceNote} />
        </label>

        <label className="field">
          <span>审核反馈</span>
          <textarea
            name="reviewFeedback"
            rows={4}
            defaultValue={post.reviewFeedback}
            placeholder="打回修改时会自动回填到这里。"
          />
        </label>

        <label className="field">
          <span>编辑点评</span>
          <textarea name="editorNote" rows={4} defaultValue={post.editorNote} />
        </label>

        <label className="checkbox-field">
          <input type="checkbox" name="featured" defaultChecked={post.featured} />
          <span>加入首页推荐</span>
        </label>

        <div className="actions-row">
          <button type="submit" className="button primary-button">
            保存修改
          </button>
        </div>
      </form>

      {post.status !== "published" ? (
        <form action={deletePostAction} className="danger-form">
          <input type="hidden" name="slug" value={post.slug} />
          <button type="submit" className="button danger-button">
            删除文章
          </button>
        </form>
      ) : (
        <p className="muted" style={{ marginTop: "24px" }}>
          提示：已发布的文章不允许直接删除。如果确实需要删除，请先将状态改为“草稿”并保存。
        </p>
      )}
    </section>
  );
}
