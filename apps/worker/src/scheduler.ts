import { nowIso } from "./db";
import { getErrorLogDetails, logCrawlError, logCrawlEvent } from "./logger";
import { executeCrawlTask, listDueScheduledTaskIds } from "./pipeline";
import type { Env } from "./types";

export async function runScheduledTasks(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
  const startedAt = nowIso();
  console.log(
    JSON.stringify({
      level: "info",
      scope: "scheduler",
      event: "cron_tick",
      timestamp: startedAt,
      cron: controller.cron
    })
  );

  const taskIds = await listDueScheduledTaskIds(env.DB);
  console.log(
    JSON.stringify({
      level: "info",
      scope: "scheduler",
      event: "cron_due_tasks",
      timestamp: nowIso(),
      cron: controller.cron,
      dueTaskIds: taskIds,
      dueCount: taskIds.length
    })
  );

  for (const taskId of taskIds) {
    ctx.waitUntil(
      (async () => {
        try {
          logCrawlEvent(env.DB, "scheduled_task_dispatch", {
            taskId,
            cron: controller.cron,
            triggeredAt: startedAt
          });
          await executeCrawlTask(env.DB, env, taskId);
        } catch (error) {
          logCrawlError(env.DB, "scheduled_task_dispatch_failed", {
            taskId,
            cron: controller.cron,
            triggeredAt: startedAt,
            ...getErrorLogDetails(error)
          });
        }
      })()
    );
  }
}
