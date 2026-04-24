import { listAllCrawlLogs } from "@devtoollab/shared/api-client";
import { CrawlLogsList } from "../tasks-board";
import { TasksNav } from "../tasks-nav";

export const dynamic = "force-dynamic";

export default async function TaskLogsPage() {
  try {
    const logs = await listAllCrawlLogs();
    
    // Ensure we always pass an array to the component
    const safeLogs = Array.isArray(logs) ? logs : [];

    return (
      <section className="admin-section">
        <div className="section-header">
          <div>
            <span className="eyebrow">任务中心</span>
            <h1>全局执行日志</h1>
            <p className="muted">实时监控系统所有抓取任务的底层运行状态。</p>
          </div>
        </div>

        <TasksNav />
        <CrawlLogsList initialLogs={safeLogs} />
      </section>
    );
  } catch (error) {
    return (
      <section className="admin-section">
        <div className="section-header">
          <div>
            <span className="eyebrow">任务中心</span>
            <h1>全局执行日志</h1>
          </div>
        </div>
        <TasksNav />
        <div className="card empty-card" style={{ textAlign: "center", padding: "40px" }}>
          <h3 style={{ color: "#b42318" }}>无法加载日志数据</h3>
          <p className="muted" style={{ marginTop: "12px" }}>
            错误原因：{error instanceof Error ? error.message : "未知 API 错误"}
          </p>
          <p className="muted">请检查 Worker API 是否正常启动，并确保数据库表已正确迁移。</p>
        </div>
      </section>
    );
  }
}
