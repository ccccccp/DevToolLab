"use client";

import Link from "next/link";
import { useRef } from "react";
import { decodeHtmlEntities, type ReviewQueueItem } from "@devtoollab/shared";
import { deleteReviewItemAction, updateReviewStatusAction } from "./actions";

type ReviewActionsProps = {
  review: ReviewQueueItem;
};

function dialogId(reviewId: string) {
  return `review-dialog-${reviewId}`;
}

function deleteDialogId(reviewId: string) {
  return `delete-review-dialog-${reviewId}`;
}

export function ReviewActions({ review }: ReviewActionsProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const decodedTitle = decodeHtmlEntities(review.title);
  const decodedEditorNote = decodeHtmlEntities(review.editorNote);

  function openDialog() {
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function openDeleteDialog() {
    deleteDialogRef.current?.showModal();
  }

  function closeDeleteDialog() {
    deleteDialogRef.current?.close();
  }

  return (
    <>
      <div className="actions-row">
        {review.entityType === "post" ? (
          <Link href={`/posts/${review.entitySlug}`} className="button">
            编辑草稿
          </Link>
        ) : null}
        {review.reviewStatus !== "approved" ? (
          <form action={updateReviewStatusAction} className="inline-form">
            <input type="hidden" name="id" value={review.id} />
            <input type="hidden" name="reviewStatus" value="approved" />
            <input type="hidden" name="editorNote" value={decodedEditorNote} />
            <button type="submit" className="button primary-button">
              {review.entityType === "post" ? "通过并发布" : "通过"}
            </button>
          </form>
        ) : null}
        {review.reviewStatus !== "pending" ? (
          <form action={updateReviewStatusAction} className="inline-form">
            <input type="hidden" name="id" value={review.id} />
            <input type="hidden" name="reviewStatus" value="pending" />
            <input type="hidden" name="editorNote" value={decodedEditorNote} />
            <button type="submit" className="button">
              重新排队
            </button>
          </form>
        ) : null}
        <button type="button" className="button danger-button" onClick={openDialog}>
          打回修改
        </button>
        {review.entityType === "post" && review.reviewStatus !== "approved" ? (
          <button type="button" className="button danger-button" onClick={openDeleteDialog}>
            删除文章并允许重抓
          </button>
        ) : null}
      </div>

      <dialog ref={dialogRef} id={dialogId(review.id)} className="review-dialog">
        <form action={updateReviewStatusAction} className="review-dialog-panel">
          <input type="hidden" name="id" value={review.id} />
          <input type="hidden" name="reviewStatus" value="changes_requested" />

          <div className="review-dialog-header">
            <div>
              <p className="eyebrow">审核反馈</p>
              <h3>{decodedTitle}</h3>
            </div>
            <button type="button" className="dialog-close" onClick={closeDialog} aria-label="关闭弹框">
              ×
            </button>
          </div>

          <p className="muted">填写明确的打回原因后提交，系统会把这段反馈回填到文章编辑页的“审核反馈”字段。</p>

          <label className="field">
            <span>打回原因</span>
            <textarea
              name="editorNote"
              rows={5}
              defaultValue={decodedEditorNote}
              placeholder="例如：标题过大、摘要不准确、标签不合适，需要补充来源说明。"
              required
            />
          </label>

          <div className="actions-row">
            <button type="submit" className="button danger-button">
              提交打回
            </button>
            <button type="button" className="button" onClick={closeDialog}>
              取消
            </button>
          </div>
        </form>
      </dialog>

      <dialog ref={deleteDialogRef} id={deleteDialogId(review.id)} className="review-dialog">
        <form action={deleteReviewItemAction} className="review-dialog-panel">
          <input type="hidden" name="id" value={review.id} />

          <div className="review-dialog-header">
            <div>
              <p className="eyebrow">删除审核文章</p>
              <h3>{decodedTitle}</h3>
            </div>
            <button type="button" className="dialog-close" onClick={closeDeleteDialog} aria-label="关闭弹框">
              ×
            </button>
          </div>

          <p className="muted">
            这会删除当前审核记录、关联文章和对应抓取去重记录。删除后，下次抓取同一原文链接时可以重新进入审核流程。
          </p>

          <div className="actions-row">
            <button type="submit" className="button danger-button">
              确认删除并允许重抓
            </button>
            <button type="button" className="button" onClick={closeDeleteDialog}>
              取消
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
