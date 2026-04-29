import { toast } from "./toast";
import { beginRequest } from "./request-progress";
import type {
  AdminUserRecord,
  CrawlItemRecord,
  CrawlLogRecord,
  CrawlRunMode,
  CrawlTaskRecord,
  CrawlTaskType,
  DashboardStats,
  PostRecord,
  ReviewQueueItem,
  SourceRecord,
  ToolRecord
} from "./index";

type RequestOptions = {
  method?: string;
  body?: unknown;
};

function logApiDebug(event: string, details: Record<string, unknown>) {
  if (typeof console !== "undefined" && typeof console.info === "function") {
    console.info(JSON.stringify({ scope: "api-client", event, ...details }));
  }
}

export type PostPayload = {
  id?: string;
  currentSlug?: string;
  currentId?: string;
  slug?: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  status: PostRecord["status"];
  sourceName: string;
  sourceUrl: string;
  sourceNote: string;
  reviewFeedback: string;
  editorNote: string;
  relatedToolSlugs: string[];
  featured: boolean;
};

export type ToolPayload = {
  currentSlug?: string;
  slug?: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  pricing: string;
  website: string;
  tags: string[];
  status: ToolRecord["status"];
  featured: boolean;
};

export type SourcePayload = {
  id?: string;
  name: string;
  slug?: string;
  type: string;
  baseUrl: string;
  feedUrl: string;
  status: SourceRecord["status"];
  enabled: boolean;
  crawlIntervalMinutes: number;
  parserKey: string;
  notes: string;
};

export type CrawlTaskPayload = {
  sourceId?: string;
  title: string;
  taskType: CrawlTaskType;
  runMode: CrawlRunMode;
  targetUrl: string;
  summary: string;
};

export type ReviewPayload = {
  entityType: ReviewQueueItem["entityType"];
  entityId: string;
  entitySlug: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  aiSummary: string;
  editorNote: string;
  priority: number;
};

export type AdminAuthPayload = {
  email: string;
  password: string;
};

export type AdminUserPayload = {
  email: string;
  displayName: string;
  password: string;
  role: AdminUserRecord["role"];
  status: AdminUserRecord["status"];
};

declare global {
  interface Window {
    __DEVTOOLLAB_API_BASE_URL__?: string;
  }
}

function getApiBaseUrl() {
  const processBaseUrl =
    typeof globalThis !== "undefined"
      ? (globalThis as typeof globalThis & {
          process?: {
            env?: {
              DEVTOOLLAB_API_BASE_URL?: string;
            };
          };
        }).process?.env?.DEVTOOLLAB_API_BASE_URL
      : undefined;
  const windowBaseUrl =
    typeof window !== "undefined" ? window.__DEVTOOLLAB_API_BASE_URL__ : undefined;
  const fallbackBaseUrl =
    typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8787";

  return (windowBaseUrl || processBaseUrl || fallbackBaseUrl).replace(/\/+$/, "");
}

function getWorkerApiSecret() {
  return (
    typeof globalThis !== "undefined"
      ? (globalThis as typeof globalThis & {
          process?: {
            env?: {
              DEVTOOLLAB_WORKER_API_SECRET?: string;
            };
          };
        }).process?.env?.DEVTOOLLAB_WORKER_API_SECRET
      : undefined
  )?.trim();
}

async function apiFetch<T>(pathname: string, options?: RequestOptions): Promise<T> {
  const url = new URL(pathname, `${getApiBaseUrl()}/`).toString();
  let response: Response;
  const endRequest = beginRequest();
  const workerApiSecret = getWorkerApiSecret();
  logApiDebug("request_start", {
    url,
    method: options?.method ?? "GET",
    hasWorkerSecret: Boolean(workerApiSecret)
  });

  try {
    response = await fetch(url, {
      method: options?.method ?? "GET",
      headers: {
        "content-type": "application/json",
        ...(workerApiSecret ? { "x-devtoollab-worker-secret": workerApiSecret } : {})
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store"
    });
  } catch (error) {
    const cause =
      error instanceof Error ? `${error.name}: ${error.message}` : "Unknown network error";
    const message = `DevToolLab API 请求失败：${url}。原始错误：${cause}`;
    
    if (typeof window !== "undefined") {
      toast.error(message);
    }
    endRequest();
    throw new Error(message);
  }

  if (!response.ok) {
    const message = await response.text();
    const errorMsg = message || `Request failed: ${response.status}`;
    
    if (typeof window !== "undefined") {
      toast.error(errorMsg);
    }
    endRequest();
    throw new Error(errorMsg);
  }

  endRequest();
  return (await response.json()) as T;
}

export function splitTags(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function getDashboardStats() {
  return apiFetch<DashboardStats>("/api/dashboard");
}

export async function listPosts(status: "published" | "draft" | "all" = "all") {
  return apiFetch<PostRecord[]>(`/api/posts?status=${status}`);
}

export async function getPostBySlug(slug: string) {
  return apiFetch<PostRecord | null>(`/api/posts/${slug}`);
}

export async function getPostById(id: string) {
  return apiFetch<PostRecord | null>(`/api/posts/id/${id}`);
}

export async function savePost(payload: PostPayload) {
  return apiFetch<PostRecord>("/api/posts", {
    method: "POST",
    body: payload
  });
}

export async function deletePost(slug: string) {
  return apiFetch<{ ok: true }>(`/api/posts/${slug}`, {
    method: "DELETE"
  });
}

export async function deletePostById(id: string) {
  return apiFetch<{ ok: true }>(`/api/posts/id/${id}`, {
    method: "DELETE"
  });
}

export async function listTools(status: "published" | "draft" | "all" = "all") {
  return apiFetch<ToolRecord[]>(`/api/tools?status=${status}`);
}

export async function getToolBySlug(slug: string) {
  return apiFetch<ToolRecord | null>(`/api/tools/${slug}`);
}

export async function saveTool(payload: ToolPayload) {
  return apiFetch<ToolRecord>("/api/tools", {
    method: "POST",
    body: payload
  });
}

export async function deleteTool(slug: string) {
  return apiFetch<{ ok: true }>(`/api/tools/${slug}`, {
    method: "DELETE"
  });
}

export async function listSources() {
  return apiFetch<SourceRecord[]>("/api/sources");
}

export async function createSource(payload: SourcePayload) {
  return apiFetch<SourceRecord>("/api/sources", {
    method: "POST",
    body: payload
  });
}

export async function saveSource(payload: SourcePayload) {
  return apiFetch<SourceRecord>("/api/sources", {
    method: "POST",
    body: payload
  });
}

export async function updateSourceStatus(id: string, status: SourceRecord["status"]) {
  return apiFetch<SourceRecord>(`/api/sources/${id}/status`, {
    method: "POST",
    body: { status }
  });
}

export async function listCrawlTasks() {
  return apiFetch<CrawlTaskRecord[]>("/api/tasks");
}

export async function createCrawlTask(payload: CrawlTaskPayload) {
  return apiFetch<CrawlTaskRecord>("/api/tasks", {
    method: "POST",
    body: payload
  });
}

export async function runCrawlTask(id: string) {
  return apiFetch<CrawlTaskRecord>(`/api/tasks/${id}/run`, {
    method: "POST"
  });
}

export async function listTaskLogs(taskId: string) {
  return apiFetch<CrawlLogRecord[]>(`/api/tasks/${taskId}/logs`);
}

export async function listAllCrawlLogs() {
  return apiFetch<CrawlLogRecord[]>("/api/crawl-logs");
}

export async function updateCrawlTaskStatus(id: string, status: CrawlTaskRecord["status"]) {
  return apiFetch<CrawlTaskRecord>(`/api/tasks/${id}/status`, {
    method: "POST",
    body: { status }
  });
}

export async function listCrawlItems() {
  return apiFetch<CrawlItemRecord[]>("/api/crawl-items");
}

export async function listReviewQueue() {
  return apiFetch<ReviewQueueItem[]>("/api/reviews");
}

export async function createReviewItem(payload: ReviewPayload) {
  return apiFetch<ReviewQueueItem>("/api/reviews", {
    method: "POST",
    body: payload
  });
}

export async function updateReviewStatus(
  id: string,
  reviewStatus: ReviewQueueItem["reviewStatus"],
  editorNote?: string
) {
  return apiFetch<ReviewQueueItem>(`/api/reviews/${id}/status`, {
    method: "POST",
    body: { reviewStatus, editorNote }
  });
}

export async function deleteReviewItem(id: string) {
  return apiFetch<{ ok: true }>(`/api/reviews/${id}`, {
    method: "DELETE"
  });
}

export async function listAdminUsers() {
  return apiFetch<AdminUserRecord[]>("/api/admin/users");
}

export async function getAdminUserById(id: string) {
  return apiFetch<AdminUserRecord | null>(`/api/admin/users/${id}`);
}

export async function loginAdminUser(payload: AdminAuthPayload) {
  return apiFetch<{ user: AdminUserRecord }>("/api/admin/auth/login", {
    method: "POST",
    body: payload
  });
}

export async function bootstrapAdminUser(payload: AdminUserPayload) {
  return apiFetch<{ user: AdminUserRecord }>("/api/admin/auth/bootstrap", {
    method: "POST",
    body: payload
  });
}

export async function createAdminUser(payload: AdminUserPayload) {
  return apiFetch<AdminUserRecord>("/api/admin/users", {
    method: "POST",
    body: payload
  });
}

export async function updateAdminUserStatus(id: string, status: AdminUserRecord["status"]) {
  return apiFetch<AdminUserRecord>(`/api/admin/users/${id}/status`, {
    method: "POST",
    body: { status }
  });
}

export async function updateAdminUserPassword(id: string, password: string) {
  return apiFetch<AdminUserRecord>(`/api/admin/users/${id}/password`, {
    method: "POST",
    body: { password }
  });
}

export async function updateAdminUserDisplayName(id: string, displayName: string) {
  return apiFetch<AdminUserRecord>(`/api/admin/users/${id}/profile`, {
    method: "POST",
    body: { displayName }
  });
}
