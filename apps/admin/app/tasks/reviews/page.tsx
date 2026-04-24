import { listReviewQueue } from "@devtoollab/shared/api-client";
import { CreateReviewDialog } from "../tasks-board";
import { TasksNav } from "../tasks-nav";
import { ReviewQueueList } from "../review-queue-list";

export const dynamic = "force-dynamic";

export default async function ReviewQueuePage() {
  const reviews = await listReviewQueue();

  return (
    <section className="admin-section">
      <div className="section-header">
        <div>
          <span className="eyebrow">任务中心</span>
          <h1>审核与编辑队列</h1>
          <p className="muted">处理待发布的内容，添加编辑反馈或直接核准上线。</p>
        </div>
        <div className="actions-row">
          <CreateReviewDialog />
        </div>
      </div>

      <TasksNav />
      <ReviewQueueList reviews={reviews} />
    </section>
  );
}
