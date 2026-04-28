"use client";

import { useMemo, useState } from "react";
import { decodeHtmlEntities, type ReviewQueueItem } from "@devtoollab/shared";
import { bulkDeleteReviewItemsAction } from "./actions";
import { ReviewActions } from "./review-actions";

function ReviewMeta({ review }: { review: ReviewQueueItem }) {
  return (
    <div className="review-list-meta">
      <span>优先级：{review.priority}</span>
      <span>入队：{new Date(review.queuedAt).toLocaleString("zh-CN")}</span>
      {review.sourceName ? <span>来源：{decodeHtmlEntities(review.sourceName)}</span> : null}
      {review.editorNote ? <span>反馈：{decodeHtmlEntities(review.editorNote)}</span> : null}
    </div>
  );
}

export function ReviewQueueList({ reviews }: { reviews: ReviewQueueItem[] }) {
  const [reviewQuery, setReviewQuery] = useState("");
  const [reviewStatus, setReviewStatus] = useState("pending");
  const [reviewEntityType, setReviewEntityType] = useState("all");
  const [reviewView, setReviewView] = useState<"cards" | "list">("list");
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);

  const filteredReviews = useMemo(() => {
    const keyword = reviewQuery.trim().toLowerCase();
    return reviews.filter((review) => {
      const matchesKeyword =
        !keyword ||
        decodeHtmlEntities(review.title).toLowerCase().includes(keyword) ||
        decodeHtmlEntities(review.aiSummary).toLowerCase().includes(keyword) ||
        decodeHtmlEntities(review.editorNote).toLowerCase().includes(keyword);
      const matchesStatus = reviewStatus === "all" || review.reviewStatus === reviewStatus;
      const matchesEntityType = reviewEntityType === "all" || review.entityType === reviewEntityType;
      return matchesKeyword && matchesStatus && matchesEntityType;
    });
  }, [reviewEntityType, reviewQuery, reviewStatus, reviews]);

  const selectableReviewIds = useMemo(() => filteredReviews.map((review) => review.id), [filteredReviews]);

  const selectedVisibleCount = selectedReviewIds.filter((id) => selectableReviewIds.includes(id)).length;
  const allVisibleSelected =
    selectableReviewIds.length > 0 && selectableReviewIds.every((id) => selectedReviewIds.includes(id));

  function toggleReviewSelection(id: string, checked: boolean) {
    setSelectedReviewIds((current) => {
      if (checked) {
        return current.includes(id) ? current : [...current, id];
      }

      return current.filter((item) => item !== id);
    });
  }

  function toggleVisibleSelection(checked: boolean) {
    setSelectedReviewIds((current) => {
      if (!checked) {
        return current.filter((id) => !selectableReviewIds.includes(id));
      }

      return Array.from(new Set([...current, ...selectableReviewIds]));
    });
  }

  return (
    <section className="admin-section">
      <div className="section-header tasks-section-header">
        <div>
          <span className="eyebrow">审核队列</span>
          <div className="section-title-row">
            <h2>待审内容</h2>
            <span className="section-count">{filteredReviews.length} 条</span>
          </div>
          <p className="muted">共 {reviews.length} 条记录，当前展示 {filteredReviews.length} 条。</p>
        </div>
        <div className="filter-stack">
          <div className="filter-bar">
            <label className="filter-field">
              <span>搜索</span>
              <input value={reviewQuery} onChange={(event) => setReviewQuery(event.target.value)} placeholder="标题 / 摘要 / 反馈" />
            </label>
            <label className="filter-field">
              <span>状态</span>
              <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)}>
                <option value="all">全部状态</option>
                <option value="pending">待审核</option>
                <option value="approved">已通过</option>
                <option value="changes_requested">打回修改</option>
              </select>
            </label>
            <label className="filter-field">
              <span>实体类型</span>
              <select value={reviewEntityType} onChange={(event) => setReviewEntityType(event.target.value)}>
                <option value="all">全部类型</option>
                <option value="post">post</option>
                <option value="tool">tool</option>
              </select>
            </label>
          </div>
          <div className="view-toggle-row">
            <span className="muted">视图</span>
            <div className="view-toggle-group">
              <button
                type="button"
                className={`button ${reviewView === "list" ? "primary-button" : ""}`}
                onClick={() => setReviewView("list")}
              >
                列表
              </button>
              <button
                type="button"
                className={`button ${reviewView === "cards" ? "primary-button" : ""}`}
                onClick={() => setReviewView("cards")}
              >
                卡片
              </button>
            </div>
          </div>
        </div>
      </div>

      {filteredReviews.length > 0 ? (
        <form action={bulkDeleteReviewItemsAction} className="bulk-action-bar">
          <label className="bulk-select-control">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              disabled={selectableReviewIds.length === 0}
              onChange={(event) => toggleVisibleSelection(event.target.checked)}
            />
            <span>选择当前筛选下的文章</span>
          </label>
          <span className="meta-line">
            已选 {selectedReviewIds.length} 篇文章，当前筛选命中 {selectedVisibleCount} 篇
          </span>
          {selectedReviewIds.map((id) => (
            <input key={id} type="hidden" name="ids" value={id} />
          ))}
          <button type="submit" className="button danger-button" disabled={selectedReviewIds.length === 0}>
            批量删除并允许重抓
          </button>
          <button type="button" className="button" onClick={() => setSelectedReviewIds([])}>
            清空选择
          </button>
        </form>
      ) : null}

      {reviewView === "list" ? (
        <div className="review-list">
          {filteredReviews.length > 0 ? (
            filteredReviews.map((review) => (
              <article className="card review-list-item" key={review.id}>
                <div className="review-list-main">
                  <div className="review-list-head">
                    <>
                      <label className="review-select-control review-list-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedReviewIds.includes(review.id)}
                          onChange={(event) => toggleReviewSelection(review.id, event.target.checked)}
                        />
                        <span>选择</span>
                      </label>
                    </>
                    <div className="badge-row">
                      <span className={`status ${review.reviewStatus}`}>{review.reviewStatus}</span>
                      <span className="status featured">{review.entityType}</span>
                    </div>
                  </div>
                  <h3>{decodeHtmlEntities(review.title)}</h3>
                  <p className="muted">{decodeHtmlEntities(review.aiSummary || "暂无 AI 摘要")}</p>
                  <ReviewMeta review={review} />
                </div>
                <div className="review-list-actions">
                  <ReviewActions review={review} />
                </div>
              </article>
            ))
          ) : (
            <article className="card compact-card empty-card">
              <h3>没有匹配的审核项</h3>
              <p className="muted">调整搜索词、状态或实体类型过滤后再试。</p>
            </article>
          )}
        </div>
      ) : (
        <div className="list-grid">
          {filteredReviews.length > 0 ? (
            filteredReviews.map((review) => (
              <article className="card compact-card" key={review.id}>
                <>
                  <label className="review-select-control">
                    <input
                      type="checkbox"
                      checked={selectedReviewIds.includes(review.id)}
                      onChange={(event) => toggleReviewSelection(review.id, event.target.checked)}
                    />
                    <span>选择</span>
                  </label>
                </>
                <div className="badge-row">
                  <span className={`status ${review.reviewStatus}`}>{review.reviewStatus}</span>
                  <span className="status featured">{review.entityType}</span>
                </div>
                <h3>{decodeHtmlEntities(review.title)}</h3>
                <p className="muted">{decodeHtmlEntities(review.aiSummary || "暂无 AI 摘要")}</p>
                <ReviewMeta review={review} />
                <ReviewActions review={review} />
              </article>
            ))
          ) : (
            <article className="card compact-card empty-card">
              <h3>没有匹配的审核项</h3>
              <p className="muted">调整搜索词、状态或实体类型过滤后再试。</p>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
