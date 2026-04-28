"use client";

import { useRef, useState } from "react";
import type { SourceRecord } from "@devtoollab/shared";
import { saveSourceAction } from "./actions";

export function EditSourceDialog({ source }: { source: SourceRecord }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  function openDialog() {
    setOpen(true);
    requestAnimationFrame(() => {
      dialogRef.current?.showModal();
    });
  }

  function closeDialog() {
    dialogRef.current?.close();
    setOpen(false);
  }

  return (
    <>
      <button type="button" className="button" onClick={openDialog}>
        编辑
      </button>
      {open ? (
        <dialog ref={dialogRef} className="review-dialog task-dialog" onClose={() => setOpen(false)}>
          <div className="review-dialog-panel">
            <div className="review-dialog-header">
              <div>
                <p className="eyebrow">采集源编辑</p>
                <h3>{source.name}</h3>
              </div>
              <button type="button" className="dialog-close" onClick={closeDialog} aria-label="关闭弹框">
                ×
              </button>
            </div>

            <form action={saveSourceAction} className="editor-form dialog-form">
              <input type="hidden" name="id" value={source.id} />

              <div className="field-grid">
                <label className="field">
                  <span>来源名称</span>
                  <input name="name" defaultValue={source.name} required />
                </label>
                <label className="field">
                  <span>Slug</span>
                  <input name="slug" defaultValue={source.slug} />
                </label>
                <label className="field">
                  <span>类型</span>
                  <select name="type" defaultValue={source.type} required>
                    <option value="news">新闻资讯 (news)</option>
                    <option value="tool-directory">工具目录 (tool-directory)</option>
                    <option value="official-blog">官方博客 (official-blog)</option>
                    <option value="product-launch">产品发布 (product-launch)</option>
                  </select>
                </label>
                <label className="field">
                  <span>状态</span>
                  <select name="status" defaultValue={source.status}>
                    <option value="active">active</option>
                    <option value="paused">paused</option>
                    <option value="error">error</option>
                  </select>
                </label>
              </div>

              <div className="field-grid">
                <label className="field">
                  <span>基础地址</span>
                  <input name="baseUrl" type="url" defaultValue={source.baseUrl} required />
                </label>
                <label className="field">
                  <span>Feed 地址</span>
                  <input name="feedUrl" defaultValue={source.feedUrl} />
                </label>
                <label className="field">
                  <span>抓取频率（分钟）</span>
                  <input
                    name="crawlIntervalMinutes"
                    type="number"
                    min="5"
                    defaultValue={String(source.crawlIntervalMinutes)}
                    required
                  />
                </label>
                <label className="field">
                  <span>解析器 Key</span>
                  <select name="parserKey" defaultValue={source.parserKey} required>
                    <option value="rss-standard">标准 RSS (rss-standard)</option>
                    <option value="product-hunt">Product Hunt RSS (product-hunt)</option>
                    <option value="hn-top">Hacker News API (hn-top)</option>
                    <option value="anthropic-newsroom">Anthropic Newsroom (custom)</option>
                  </select>
                </label>
              </div>

              <label className="field">
                <span>备注</span>
                <textarea name="notes" rows={3} defaultValue={source.notes} />
              </label>

              <label className="checkbox-field">
                <input type="checkbox" name="enabled" defaultChecked={source.enabled} />
                <span>启用该来源</span>
              </label>

              <div className="actions-row">
                <button type="submit" className="button primary-button">
                  保存修改
                </button>
                <button type="button" className="button" onClick={closeDialog}>
                  取消
                </button>
              </div>
            </form>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
