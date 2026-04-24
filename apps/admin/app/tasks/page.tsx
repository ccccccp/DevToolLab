import { listCrawlTasks, listSources } from "@devtoollab/shared/api-client";
import { CreateTaskDialog, TasksControl } from "./tasks-board";
import { TasksNav } from "./tasks-nav";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [sources, tasks] = await Promise.all([
    listSources(),
    listCrawlTasks()
  ]);

  return (
    <section className="admin-section">
      <div className="section-header">
        <div>
          <span className="eyebrow">任务中心</span>
          <h1>抓取任务与调度</h1>
          <p className="muted">管理采集任务的执行状态，手动触发或配置自动运行。</p>
        </div>
        <div className="actions-row">
          <CreateTaskDialog sources={sources} />
        </div>
      </div>

      <TasksNav />
      <TasksControl sources={sources} tasks={tasks} />
    </section>
  );
}
