export type PostStatus = "draft" | "published";
export type ToolStatus = "draft" | "published";
export type SourceStatus = "active" | "paused" | "error";
export type CrawlTaskStatus = "pending" | "running" | "completed" | "failed";
export type ReviewStatus = "pending" | "approved" | "changes_requested";
export type CrawlRunMode = "manual" | "scheduled";
export type AdminUserRole = "admin" | "editor";
export type AdminUserStatus = "active" | "disabled";

export const crawlTaskTypeOptions = [
  {
    value: "crawl",
    label: "常规抓取"
  },
  {
    value: "recrawl",
    label: "重新抓取"
  },
  {
    value: "backfill",
    label: "历史补抓"
  },
  {
    value: "test",
    label: "调试验证"
  }
] as const;

export type CrawlTaskType = (typeof crawlTaskTypeOptions)[number]["value"];

export const crawlRunModeOptions = [
  {
    value: "manual",
    label: "手动触发"
  },
  {
    value: "scheduled",
    label: "定时触发"
  }
] as const;

export function isCrawlTaskType(value: string): value is CrawlTaskType {
  return crawlTaskTypeOptions.some((option) => option.value === value);
}

export function isCrawlRunMode(value: string): value is CrawlRunMode {
  return crawlRunModeOptions.some((option) => option.value === value);
}

export function getCrawlTaskTypeLabel(value: CrawlTaskType | string) {
  return crawlTaskTypeOptions.find((option) => option.value === value)?.label ?? value;
}

export function getCrawlRunModeLabel(value: CrawlRunMode | string) {
  return crawlRunModeOptions.find((option) => option.value === value)?.label ?? value;
}

export type PostRecord = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  tags: string[];
  status: PostStatus;
  sourceName: string;
  sourceUrl: string;
  sourceNote: string;
  reviewFeedback: string;
  editorNote: string;
  relatedToolSlugs: string[];
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type ToolRecord = {
  id: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  pricing: string;
  website: string;
  tags: string[];
  status: ToolStatus;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SourceRecord = {
  id: string;
  name: string;
  slug: string;
  type: string;
  baseUrl: string;
  feedUrl: string;
  status: SourceStatus;
  enabled: boolean;
  crawlIntervalMinutes: number;
  parserKey: string;
  notes: string;
  lastCrawledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CrawlTaskRecord = {
  id: string;
  sourceId: string | null;
  sourceName: string | null;
  title: string;
  taskType: CrawlTaskType;
  status: CrawlTaskStatus;
  runMode: CrawlRunMode;
  targetUrl: string;
  summary: string;
  itemsFound: number;
  errorMessage: string;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
};

export type ReviewQueueItem = {
  id: string;
  entityType: "post" | "tool";
  entityId: string;
  entitySlug: string;
  title: string;
  sourceName: string;
  sourceUrl: string;
  reviewStatus: ReviewStatus;
  aiSummary: string;
  editorNote: string;
  priority: number;
  queuedAt: string;
  reviewedAt: string | null;
  updatedAt: string;
};

export type CrawlItemRecord = {
  id: string;
  taskId: string;
  sourceId: string;
  sourceName: string;
  externalId: string | null;
  title: string;
  url: string;
  author: string;
  summary: string;
  contentSnippet: string;
  rawContent: string;
  extractionStatus: string;
  aiOutputJson: string;
  publishedAt: string | null;
  dedupeHash: string;
  createdPostId: string | null;
  reviewQueueId: string | null;
  fetchedAt: string;
};

export type CrawlLogRecord = {
  id: number;
  taskId: string;
  level: "info" | "warn" | "error";
  eventType: string;
  message: string;
  payloadJson: string;
  createdAt: string;
};

export type AdminUserRecord = {
  id: string;
  email: string;
  displayName: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
};

export type DashboardStats = {
  posts: number;
  publishedPosts: number;
  draftPosts: number;
  tools: number;
  publishedTools: number;
  featuredTools: number;
  sources: number;
  activeSources: number;
  crawlTasks: number;
  crawlItems: number;
  pendingReviews: number;
};

export type AdminSection = {
  slug: string;
  label: string;
  href: string;
  description: string;
};

export type PipelineStage = {
  key: string;
  label: string;
  description: string;
};

const htmlEntityMap: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: " "
};

export function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (entity) => {
    if (entity.startsWith("&#x") || entity.startsWith("&#X")) {
      const codePoint = Number.parseInt(entity.slice(3, -1), 16);
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
    }

    if (entity.startsWith("&#")) {
      const codePoint = Number.parseInt(entity.slice(2, -1), 10);
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
    }

    const named = htmlEntityMap[entity.slice(1, -1)];
    return named ?? entity;
  });
}

export const siteMeta = {
  name: "DevToolLab",
  description: "一个把内容站、工具站、轻 CMS 和 AI 处理流水线放在同一套单仓里的项目骨架。"
} as const;

export const adminSections: AdminSection[] = [
  {
    slug: "posts",
    label: "文章管理",
    href: "/posts",
    description: "管理草稿、已发布文章、编辑点评和来源链接。"
  },
  {
    slug: "tools",
    label: "工具管理",
    href: "/tools",
    description: "管理工具实体、分类、官网、标签和推荐状态。"
  },
  {
    slug: "sources",
    label: "采集源",
    href: "/sources",
    description: "管理抓取目标、更新频率、解析器和来源状态。"
  },
  {
    slug: "tasks",
    label: "任务中心",
    href: "/tasks",
    description: "查看抓取任务、失败记录和待审核队列。"
  }
];

export const pipelineStages: PipelineStage[] = [
  {
    key: "ingest",
    label: "采集入库",
    description: "抓取外部来源并保留原始记录。"
  },
  {
    key: "dedupe",
    label: "去重聚合",
    description: "避免同一热点被重复进入编辑队列。"
  },
  {
    key: "summarize",
    label: "AI 摘要",
    description: "生成摘要、关键词和结构化元信息。"
  },
  {
    key: "review",
    label: "人工审核",
    description: "人工判断是否可发布、是否需要改写。"
  },
  {
    key: "publish",
    label: "发布分发",
    description: "发布到前台并同步到推荐位与后续渠道。"
  }
];

export * from "./api-client";
export * from "./request-progress";
export * from "./toast";
