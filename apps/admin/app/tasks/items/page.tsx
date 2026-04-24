import { listCrawlItems, listSources } from "@devtoollab/shared/api-client";
import { CrawlItemsList } from "../tasks-board";
import { TasksNav } from "../tasks-nav";

export const dynamic = "force-dynamic";

export default async function CrawlItemsPage() {
  const [sources, crawlItems] = await Promise.all([
    listSources(),
    listCrawlItems()
  ]);

  return (
    <section className="admin-section">
      <div className="section-header">
        <div>
          <span className="eyebrow">任务中心</span>
          <h1>抓取历史记录</h1>
          <p className="muted">查看所有已入库的原始数据条目，追踪内容来源。</p>
        </div>
      </div>

      <TasksNav />
      <CrawlItemsList sources={sources} crawlItems={crawlItems} />
    </section>
  );
}
