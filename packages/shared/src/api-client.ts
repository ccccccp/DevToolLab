import { toast } from "./toast";
import type {
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

export type PostPayload = {
  currentSlug?: string;
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

async function apiFetch<T>(pathname: string, options?: RequestOptions): Promise<T> {
  const url = new URL(pathname, `${getApiBaseUrl()}/`).toString();
  let response: Response;

  try {
    response = await fetch(url, {
      method: options?.method ?? "GET",
      headers: {
        "content-type": "application/json"
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
    
    throw new Error(message);
  }

  if (!response.ok) {
    const message = await response.text();
    const errorMsg = message || `Request failed: ${response.status}`;
    
    if (typeof window !== "undefined") {
      toast.error(errorMsg);
    }
    
    throw new Error(errorMsg);
  }

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
