"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  crawlRunModeOptions,
  crawlTaskTypeOptions,
  decodeHtmlEntities,
  getCrawlRunModeLabel,
  getCrawlTaskTypeLabel,
  type CrawlItemRecord,
  type CrawlLogRecord,
  type CrawlTaskRecord,
  type ReviewQueueItem,
  type SourceRecord
} from "@devtoollab/shared";
import { listTaskLogs, runCrawlTask } from "@devtoollab/shared/api-client";
import {
  bulkDeleteReviewItemsAction,
  createCrawlTaskAction,
  createReviewItemAction,
  updateCrawlTaskStatusAction
} from "./actions";
import { ReviewActions } from "./review-actions";

type ParsedCrawlLogPayload = Record<string, unknown> | null;

// --- Dialog Components ---

function DialogLauncher({
  buttonLabel,
  dialogTitle,
  description,
  children
}: {
  buttonLabel: string;
  dialogTitle: string;
  description: string;
  children: ReactNode;
}) {
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
      <button type="button" className="button primary-button" onClick={openDialog}>
        {buttonLabel}
      </button>
      {open ? (
        <dialog ref={dialogRef} className="review-dialog task-dialog" onClose={() => setOpen(false)}>
          <div className="review-dialog-panel">
            <div className="review-dialog-header">
              <div>
                <p className="eyebrow">快速创建</p>
                <h3>{dialogTitle}</h3>
              </div>
              <button type="button" className="dialog-close" onClick={closeDialog} aria-label="关闭弹框">
                ×
              </button>
            </div>
            <p className="muted">{description}</p>
            {children}
          </div>
        </dialog>
      ) : null}
    </>
  );
}

export function CreateTaskDialog({ sources }: { sources: SourceRecord[] }) {
  return (
    <DialogLauncher
      buttonLabel="创建抓取任务"
      dialogTitle="创建抓取任务"
      description="快速指定来源、运行模式和目标链接。提交后会在任务列表中生成一条新的抓取任务。"
    >
      <form action={createCrawlTaskAction} className="editor-form dialog-form">
        <div className="field-grid">
          <label className="field">
            <span>来源</span>
            <select name="sourceId" defaultValue="">
              <option value="">不绑定来源</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {decodeHtmlEntities(source.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>任务类型</span>
            <select name="taskType" defaultValue="crawl">
              {crawlTaskTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>运行模式</span>
            <select name="runMode" defaultValue="manual">
              {crawlRunModeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>目标链接</span>
            <input name="targetUrl" placeholder="可选，留空则使用来源默认地址" />
          </label>
        </div>
        <label className="field">
          <span>任务标题</span>
          <input name="title" placeholder="例如：抓取 OpenAI News 最新发布" required />
        </label>
        <label className="field">
          <span>任务说明</span>
          <textarea name="summary" rows={4} />
        </label>
        <div className="actions-row">
          <button type="submit" className="button primary-button">
            创建任务
          </button>
        </div>
      </form>
    </DialogLauncher>
  );
}

export function CreateReviewDialog() {
  return (
    <DialogLauncher
      buttonLabel="手动加入审核队列"
      dialogTitle="手动加入审核队列"
      description="适合人工补录待审内容，提交后会直接进入审核列表。"
    >
      <form action={createReviewItemAction} className="editor-form dialog-form">
        <div className="field-grid">
          <label className="field">
            <span>实体类型</span>
            <select name="entityType" defaultValue="post">
              <option value="post">post</option>
              <option value="tool">tool</option>
            </select>
          </label>
          <label className="field">
            <span>实体 ID</span>
            <input name="entityId" placeholder="例如：post_xxx" required />
          </label>
          <label className="field">
            <span>实体 Slug</span>
            <input name="entitySlug" placeholder="例如：openai-new-release" required />
          </label>
          <label className="field">
            <span>优先级</span>
            <input name="priority" type="number" min="1" max="5" defaultValue="3" required />
          </label>
        </div>
        <label className="field">
          <span>标题</span>
          <input name="title" required />
        </label>
        <div className="field-grid">
          <label className="field">
            <span>来源名称</span>
            <input name="sourceName" />
          </label>
          <label className="field">
            <span>来源链接</span>
            <input name="sourceUrl" />
          </label>
        </div>
        <label className="field">
          <span>AI 摘要</span>
          <textarea name="aiSummary" rows={4} />
        </label>
        <label className="field">
          <span>编辑备注</span>
          <textarea name="editorNote" rows={4} />
        </label>
        <div className="actions-row">
          <button type="submit" className="button primary-button">
            加入审核队列
          </button>
        </div>
      </form>
    </DialogLauncher>
  );
}

function SectionMeta({
  eyebrow,
  title,
  count,
  description
}: {
  eyebrow: string;
  title: string;
  count: number;
  description: string;
}) {
  return (
    <div>
      <span className="eyebrow">{eyebrow}</span>
      <div className="section-title-row">
        <h2>{title}</h2>
        <span className="section-count">{count} 条</span>
      </div>
      <p className="muted">{description}</p>
    </div>
  );
}

function safeParseCrawlLogPayload(payloadJson: string): ParsedCrawlLogPayload {
  if (!payloadJson || payloadJson === "{}") {
    return null;
  }

  try {
    const parsed = JSON.parse(payloadJson);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function toPreview(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return "";
  }

  const text = decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
  if (!text) {
    return "";
  }

  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function buildCrawlLogHighlights(log: CrawlLogRecord, payload: ParsedCrawlLogPayload) {
  if (!payload) {
    return [];
  }

  if (log.eventType === "article_fetch_complete") {
    const contentFound = payload.contentFound === true;
    const contentPreview = toPreview(payload.contentPreview, 140);
    const excerptPreview = toPreview(payload.excerptPreview, 140);

    return [
      `正文状态：${contentFound ? "已抓到" : "未抓到"}`,
      contentPreview ? `正文预览：${contentPreview}` : "",
      excerptPreview ? `摘要预览：${excerptPreview}` : ""
    ].filter(Boolean);
  }

  if (log.eventType === "ai_content_complete") {
    const generationMode = String(payload.generationMode || "");
    const summaryPreview = toPreview(payload.summaryPreview, 140);
    const contentPreview = toPreview(payload.contentPreview, 140);

    return [
      generationMode ? `生成模式：${generationMode}` : "",
      summaryPreview ? `AI 摘要：${summaryPreview}` : "",
      contentPreview ? `AI 内容：${contentPreview}` : ""
    ].filter(Boolean);
  }

  return [];
}

function TaskRunLogDialog({ task }: { task: CrawlTaskRecord }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const logViewportRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<CrawlLogRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

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

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    let shouldStopPolling = false;
    let intervalId = window.setInterval(() => {
      if (!shouldStopPolling) {
        void refreshLogs();
      }
    }, 1000);

    async function refreshLogs() {
      try {
        const items = await listTaskLogs(task.id);
        if (cancelled) {
          return;
        }

        setLogs(Array.isArray(items) ? items : []);
        const latest = Array.isArray(items) && items.length > 0 ? items[items.length - 1] : null;
        if (latest && (latest.eventType === "task_complete" || latest.eventType === "task_failed")) {
          shouldStopPolling = true;
          window.clearInterval(intervalId);
          setRunning(false);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : String(error));
        }
      }
    }

    setRunning(true);
    setErrorMessage("");
    setLogs([]);
    void refreshLogs();
    void (async () => {
      try {
        await runCrawlTask(task.id);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setRunning(false);
          await refreshLogs();
        }
      }
    })();

    return () => {
      cancelled = true;
      shouldStopPolling = true;
      window.clearInterval(intervalId);
    };
  }, [open, task.id]);

  useEffect(() => {
    const viewport = logViewportRef.current;
    if (!open || !viewport) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
  }, [logs, open]);

  const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;
  const latestPayload = latestLog ? safeParseCrawlLogPayload(latestLog.payloadJson) : null;
  const latestHighlights = latestLog ? buildCrawlLogHighlights(latestLog, latestPayload) : [];

  return (
    <>
      <button type="button" className="button primary-button" onClick={openDialog}>
        立即执行
      </button>

      {open ? (
        <dialog ref={dialogRef} className="review-dialog task-run-dialog" onClose={() => setOpen(false)}>
          <div className="review-dialog-panel task-run-panel">
            <div className="review-dialog-header">
              <div>
                <p className="eyebrow">任务执行监控</p>
                <h3>{decodeHtmlEntities(task.title)}</h3>
                <p className="muted">任务 ID：{task.id}</p>
              </div>
              <button type="button" className="dialog-close" onClick={closeDialog} aria-label="关闭弹框">
                ×
              </button>
            </div>

            <div className="task-run-summary">
              <span className={`status ${task.status}`}>{task.status}</span>
              <span className="status featured">{getCrawlTaskTypeLabel(task.taskType)}</span>
              <span className="status featured">{getCrawlRunModeLabel(task.runMode)}</span>
              <span className="meta-line">{running ? "正在执行..." : "执行已结束或等待刷新结果"}</span>
            </div>

            {errorMessage ? <p className="task-run-error">日志读取失败：{errorMessage}</p> : null}

            <div className="task-run-log-viewport" ref={logViewportRef}>
              {logs.length > 0 ? (
                logs.map((log) => {
                  const payload = safeParseCrawlLogPayload(log.payloadJson);
                  const highlights = buildCrawlLogHighlights(log, payload);

                  return (
                    <div key={log.id} className={`task-run-log-row task-run-log-${log.level}`}>
                      <div className="task-run-log-head">
                        <span className="task-run-log-time">{new Date(log.createdAt).toLocaleTimeString("zh-CN")}</span>
                        <span className="task-run-log-level">{log.level}</span>
                        <span className="task-run-log-event">{log.eventType}</span>
                      </div>
                      <div className="task-run-log-message">{log.message}</div>
                      {highlights.length > 0 ? (
                        <div className="log-highlight-list">
                          {highlights.map((line) => (
                            <div key={line} className="log-highlight-item">
                              {line}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              ) : (
                <div className="empty-state">执行后这里会实时显示日志</div>
              )}
            </div>

            {latestLog ? (
              <div className="task-run-footer">
                <span className="muted">最新事件：{latestLog.eventType}</span>
                {latestHighlights.length > 0 ? <span className="muted">{latestHighlights[0]}</span> : null}
              </div>
            ) : null}
          </div>
        </dialog>
      ) : null}
    </>
  );
}

// --- Main Boards ---

export function TasksControl({ sources, tasks }: { sources: SourceRecord[]; tasks: CrawlTaskRecord[] }) {
  const [taskQuery, setTaskQuery] = useState("");
  const [taskStatus, setTaskStatus] = useState("all");
  const [taskSource, setTaskSource] = useState("all");

  const filteredTasks = useMemo(() => {
    const keyword = taskQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesKeyword =
        !keyword ||
        decodeHtmlEntities(task.title).toLowerCase().includes(keyword) ||
        decodeHtmlEntities(task.summary).toLowerCase().includes(keyword) ||
        decodeHtmlEntities(task.sourceName ?? "").toLowerCase().includes(keyword);
      const matchesStatus = taskStatus === "all" || task.status === taskStatus;
      const matchesSource = taskSource === "all" || task.sourceId === taskSource;
      return matchesKeyword && matchesStatus && matchesSource;
    });
  }, [taskQuery, taskSource, taskStatus, tasks]);

  return (
    <section className="admin-section">
      <div className="section-header tasks-section-header">
        <SectionMeta
          eyebrow="抓取任务"
          title="任务执行状态"
          count={filteredTasks.length}
          description={`共 ${tasks.length} 条任务记录，当前展示 ${filteredTasks.length} 条。`}
        />
        <div className="filter-bar">
          <label className="filter-field">
            <span>搜索</span>
            <input value={taskQuery} onChange={(event) => setTaskQuery(event.target.value)} placeholder="标题 / 摘要 / 来源" />
          </label>
          <label className="filter-field">
            <span>状态</span>
            <select value={taskStatus} onChange={(event) => setTaskStatus(event.target.value)}>
              <option value="all">全部状态</option>
              <option value="pending">pending</option>
              <option value="running">running</option>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
            </select>
          </label>
          <label className="filter-field">
            <span>来源</span>
            <select value={taskSource} onChange={(event) => setTaskSource(event.target.value)}>
              <option value="all">全部来源</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {decodeHtmlEntities(source.name)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="list-grid">
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => (
            <article className="card compact-card" key={task.id}>
              <div className="badge-row">
                <span className={`status ${task.status}`}>{task.status}</span>
                {task.sourceName ? <span className="status featured">{decodeHtmlEntities(task.sourceName)}</span> : null}
              </div>
              <h3>{decodeHtmlEntities(task.title)}</h3>
              <p className="muted">{decodeHtmlEntities(task.summary || "暂无任务说明")}</p>
              <p className="meta-line">类型：{getCrawlTaskTypeLabel(task.taskType)}</p>
              <p className="meta-line">模式：{getCrawlRunModeLabel(task.runMode)}</p>
              <p className="meta-line">抓取条数：{task.itemsFound}</p>
              {task.errorMessage ? <p className="meta-line">错误：{decodeHtmlEntities(task.errorMessage)}</p> : null}
              <p className="meta-line">请求时间：{new Date(task.requestedAt).toLocaleString("zh-CN")}</p>
              <div className="actions-row">
                <TaskRunLogDialog task={task} />
                {task.status !== "completed" ? (
                  <form action={updateCrawlTaskStatusAction} className="inline-form">
                    <input type="hidden" name="id" value={task.id} />
                    <input type="hidden" name="status" value="completed" />
                    <button type="submit" className="button">
                      标记完成
                    </button>
                  </form>
                ) : null}
                {task.status !== "failed" ? (
                  <form action={updateCrawlTaskStatusAction} className="inline-form">
                    <input type="hidden" name="id" value={task.id} />
                    <input type="hidden" name="status" value="failed" />
                    <button type="submit" className="button danger-button">
                      标记失败
                    </button>
                  </form>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <article className="card compact-card empty-card">
            <h3>没有匹配的任务</h3>
            <p className="muted">调整搜索词、状态或来源过滤后再试。</p>
          </article>
        )}
      </div>
    </section>
  );
}

export function CrawlItemsList({ sources, crawlItems }: { sources: SourceRecord[]; crawlItems: CrawlItemRecord[] }) {
  const [itemQuery, setItemQuery] = useState("");
  const [itemSource, setItemSource] = useState("all");
  const [itemQueueState, setItemQueueState] = useState("all");

  const filteredItems = useMemo(() => {
    const keyword = itemQuery.trim().toLowerCase();
    return crawlItems.filter((item) => {
      const matchesKeyword =
        !keyword ||
        decodeHtmlEntities(item.title).toLowerCase().includes(keyword) ||
        decodeHtmlEntities(item.summary).toLowerCase().includes(keyword) ||
        decodeHtmlEntities(item.author).toLowerCase().includes(keyword);
      const matchesSource = itemSource === "all" || item.sourceId === itemSource;
      const matchesQueueState =
        itemQueueState === "all" ||
        (itemQueueState === "queued" && Boolean(item.reviewQueueId)) ||
        (itemQueueState === "unqueued" && !item.reviewQueueId);
      return matchesKeyword && matchesSource && matchesQueueState;
    });
  }, [crawlItems, itemQuery, itemQueueState, itemSource]);

  return (
    <section className="admin-section">
      <div className="section-header tasks-section-header">
        <SectionMeta
          eyebrow="抓取结果"
          title="最近入库的抓取条目"
          count={filteredItems.length}
          description={`共 ${crawlItems.length} 条抓取记录，当前展示 ${filteredItems.length} 条。`}
        />
        <div className="filter-bar">
          <label className="filter-field">
            <span>搜索</span>
            <input value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder="标题 / 摘要 / 作者" />
          </label>
          <label className="filter-field">
            <span>来源</span>
            <select value={itemSource} onChange={(event) => setItemSource(event.target.value)}>
              <option value="all">全部来源</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {decodeHtmlEntities(source.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-field">
            <span>审核状态</span>
            <select value={itemQueueState} onChange={(event) => setItemQueueState(event.target.value)}>
              <option value="all">全部</option>
              <option value="queued">已入审核</option>
              <option value="unqueued">未入审核</option>
            </select>
          </label>
        </div>
      </div>
      <div className="list-grid">
        {filteredItems.length > 0 ? (
          filteredItems.map((item) => (
            <article className="card compact-card" key={item.id}>
              <div className="badge-row">
                <span className="status featured">{decodeHtmlEntities(item.sourceName || "")}</span>
                {item.reviewQueueId ? <span className="status pending">已入审核</span> : null}
              </div>
              <h3>{decodeHtmlEntities(item.title)}</h3>
              <p className="muted">{decodeHtmlEntities(item.summary || item.contentSnippet || "暂无摘要")}</p>
              <p className="meta-line">作者：{decodeHtmlEntities(item.author || "unknown")}</p>
              <p className="meta-line">抓取时间：{new Date(item.fetchedAt).toLocaleString("zh-CN")}</p>
              {item.createdPostId ? <p className="meta-line">关联实体 ID：{item.createdPostId}</p> : null}
              <a className="text-link" href={item.url} target="_blank" rel="noreferrer">
                查看原文
              </a>
            </article>
          ))
        ) : (
          <article className="card compact-card empty-card">
            <h3>没有匹配的抓取结果</h3>
            <p className="muted">调整搜索词、来源或审核状态过滤后再试。</p>
          </article>
        )}
      </div>
    </section>
  );
}

export function CrawlLogsList({ initialLogs }: { initialLogs: CrawlLogRecord[] }) {
  const [logs, setLogs] = useState(Array.isArray(initialLogs) ? initialLogs : []);
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");

  const filteredLogs = useMemo(() => {
    if (!Array.isArray(logs)) return [];
    return logs.filter((log) => {
      const matchesKeyword =
        !query ||
        log.message.toLowerCase().includes(query.toLowerCase()) ||
        log.eventType.toLowerCase().includes(query.toLowerCase()) ||
        log.taskId.toLowerCase().includes(query.toLowerCase());
      const matchesLevel = levelFilter === "all" || log.level === levelFilter;
      return matchesKeyword && matchesLevel;
    });
  }, [logs, query, levelFilter]);

  const logsWithHighlights = useMemo(
    () =>
      filteredLogs.map((log) => ({
        log,
        payload: safeParseCrawlLogPayload(log.payloadJson)
      })),
    [filteredLogs]
  );

  return (
    <section className="admin-section">
      <div className="section-header tasks-section-header">
        <div>
          <span className="eyebrow">执行日志</span>
          <div className="section-title-row">
            <h2>系统流水</h2>
            <span className="section-count">{filteredLogs.length} 条</span>
          </div>
          <p className="muted">显示最近 200 条系统操作记录，包含抓取进度、AI 调用及入库状态。</p>
        </div>
        <div className="filter-bar">
          <label className="filter-field">
            <span>搜索</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="消息 / 事件 / 任务 ID"
            />
          </label>
          <label className="filter-field">
            <span>级别</span>
            <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
              <option value="all">全部级别</option>
              <option value="info">Info</option>
              <option value="warn">Warning</option>
              <option value="error">Error</option>
            </select>
          </label>
        </div>
      </div>

      <div className="log-table-container card">
        <div className="log-table-header">
          <span className="col-time">时间</span>
          <span className="col-level">级别</span>
          <span className="col-event">事件</span>
          <span className="col-message">详细消息</span>
        </div>
        <div className="log-table-body">
          {logsWithHighlights.length > 0 ? (
            logsWithHighlights.map(({ log, payload }) => {
              const highlights = buildCrawlLogHighlights(log, payload);

              return (
                <div key={log.id} className={`log-row log-${log.level}`}>
                  <span className="col-time">{new Date(log.createdAt).toLocaleTimeString()}</span>
                  <span className="col-level badge">{log.level}</span>
                  <span className="col-event">{log.eventType}</span>
                  <span className="col-message">
                    {log.message}
                    {highlights.length > 0 ? (
                      <div className="log-highlight-list">
                        {highlights.map((line) => (
                          <div key={line} className="log-highlight-item">
                            {line}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {payload ? (
                      <details className="log-details">
                        <summary>查看详情</summary>
                        <pre>{JSON.stringify(payload, null, 2)}</pre>
                      </details>
                    ) : null}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="empty-state">暂无符合条件的日志</div>
          )}
        </div>
      </div>
    </section>
  );
}

export function ReviewQueueList({ reviews }: { reviews: ReviewQueueItem[] }) {
  const [reviewQuery, setReviewQuery] = useState("");
  const [reviewStatus, setReviewStatus] = useState("all");
  const [reviewEntityType, setReviewEntityType] = useState("all");
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

  const selectableReviewIds = useMemo(
    () => filteredReviews.filter((review) => review.entityType === "post").map((review) => review.id),
    [filteredReviews]
  );
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
        <SectionMeta
          eyebrow="审核队列"
          title="待审核内容与编辑反馈"
          count={filteredReviews.length}
          description={`共 ${reviews.length} 条待审记录，当前展示 ${filteredReviews.length} 条。`}
        />
        <div className="filter-bar">
          <label className="filter-field">
            <span>搜索</span>
            <input value={reviewQuery} onChange={(event) => setReviewQuery(event.target.value)} placeholder="标题 / 摘要 / 反馈" />
          </label>
          <label className="filter-field">
            <span>状态</span>
            <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value)}>
              <option value="all">全部状态</option>
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="changes_requested">changes_requested</option>
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
            已选 {selectedReviewIds.length} 篇文章，当前页命中 {selectedVisibleCount} 篇
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
      <div className="list-grid">
        {filteredReviews.length > 0 ? (
          filteredReviews.map((review) => (
            <article className="card compact-card" key={review.id}>
              {review.entityType === "post" ? (
                <label className="review-select-control">
                  <input
                    type="checkbox"
                    checked={selectedReviewIds.includes(review.id)}
                    onChange={(event) => toggleReviewSelection(review.id, event.target.checked)}
                  />
                  <span>选择</span>
                </label>
              ) : null}
              <div className="badge-row">
                <span className={`status ${review.reviewStatus}`}>{review.reviewStatus}</span>
                <span className="status featured">{review.entityType}</span>
              </div>
              <h3>{decodeHtmlEntities(review.title)}</h3>
              <p className="muted">{decodeHtmlEntities(review.aiSummary || "暂无 AI 摘要")}</p>
              {review.editorNote ? <p className="meta-line">反馈：{decodeHtmlEntities(review.editorNote)}</p> : null}
              <p className="meta-line">优先级：{review.priority}</p>
              <p className="meta-line">入队时间：{new Date(review.queuedAt).toLocaleString("zh-CN")}</p>
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
    </section>
  );
}
