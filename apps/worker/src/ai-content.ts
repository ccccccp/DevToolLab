type AiContentBindings = {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_API_BASE?: string;
  OPENAI_MODEL?: string;
  OPENAI_TIMEOUT_MS?: string;
};

export type AiContentInput = {
  sourceName: string;
  sourceType: string;
  title: string;
  url: string;
  author?: string;
  summary?: string;
  contentSnippet?: string;
  articleText?: string;
  publishedAt?: string | null;
};

export type GeneratedArticleContent = {
  title: string;
  summary: string;
  content: string;
  tags: string[];
  sourceNote: string;
  model: string;
  usedFallback: boolean;
};

type Message = {
  role: "system" | "user";
  content: string;
};

const DEFAULT_OPENAI_TIMEOUT_MS = 8_000;
const AI_COOLDOWN_MS = 60_000;
const MAX_INPUT_TEXT_LENGTH = 12_000;
const MAX_TAGS = 5;

let aiUnavailableUntil = 0;

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function normalizeTags(tags: unknown, sourceType: string) {
  const values = Array.isArray(tags) ? tags : [];
  const normalized = values
    .map((tag) => cleanText(String(tag)).toLowerCase())
    .filter(Boolean)
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .slice(0, MAX_TAGS);

  return normalized.length > 0 ? normalized : [sourceType, "ai"];
}

function buildFallbackSummary(input: AiContentInput) {
  const raw = cleanText(input.articleText || input.summary || input.contentSnippet || "");
  if (raw) {
    return `内容来自 ${input.sourceName}，核心信息是：${truncate(raw, 120)}`;
  }

  return `内容来自 ${input.sourceName}，当前仅抓取到标题，发布前需要补充原文信息。`;
}

function buildFallbackContent(input: AiContentInput): GeneratedArticleContent {
  const summary = buildFallbackSummary(input);
  const content = [
    "## 核心摘要",
    summary,
    "",
    "## 重点信息",
    `- 来源：${input.sourceName}`,
    `- 原文：${input.url}`,
    input.publishedAt ? `- 发布时间：${input.publishedAt}` : "- 发布时间：未知",
    "",
    "## 编辑提醒",
    "正文抓取或 AI 生成不完整，发布前请人工核对原文、补充背景，并确认来源授权与引用边界。"
  ].join("\n");

  return {
    title: input.title,
    summary: truncate(summary, 240),
    content,
    tags: [input.sourceType, "ai"],
    sourceNote: `内容基于 ${input.sourceName} 的公开信息生成，发布前请核对原文。`,
    model: "fallback",
    usedFallback: true
  };
}

function buildNoArticleContent(input: AiContentInput): GeneratedArticleContent {
  return {
    title: input.title,
    summary: "无",
    content: "无",
    tags: [input.sourceType, "no-content"],
    sourceNote: `未抓取到正文，仅保留来源信息：${input.sourceName}。`,
    model: "no-content",
    usedFallback: true
  };
}

function resolveTimeoutMs(bindings: AiContentBindings) {
  const parsed = Number.parseInt(bindings.OPENAI_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_OPENAI_TIMEOUT_MS;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(`timeout:${timeoutMs}`), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseJsonObject(value: string) {
  const cleaned = value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI response is not a JSON object");
  }

  return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
}

function normalizeAiOutput(payload: Record<string, unknown>, input: AiContentInput, model: string): GeneratedArticleContent {
  const fallback = buildFallbackContent(input);
  const title = cleanText(String(payload.title || "")) || fallback.title;
  const summary = cleanText(String(payload.summary || "")) || fallback.summary;
  const content = String(payload.content || "").trim() || fallback.content;
  const sourceNote = cleanText(String(payload.sourceNote || "")) || fallback.sourceNote;

  return {
    title: truncate(title, 120),
    summary: truncate(summary, 240),
    content,
    tags: normalizeTags(payload.tags, input.sourceType),
    sourceNote: truncate(sourceNote, 260),
    model,
    usedFallback: false
  };
}

export function buildAiContentMessages(input: AiContentInput, articleText: string): Message[] {
  const sourceText = truncate(articleText || input.contentSnippet || input.summary || "", MAX_INPUT_TEXT_LENGTH);

  const systemPrompt =
    "你是内容站的中文编辑助手。你只能基于提供的原始材料写作，不得编造事实。输出必须是合法 JSON，不要输出 Markdown 代码块。";

  const userPrompt = [
    "请基于下面的抓取内容，生成一条适合人工审核的中文短内容。",
    "要求：",
    "1. 只输出 JSON，且只包含 title、summary、content、tags、sourceNote 这几个字段。",
    "2. summary 写成 1 段中文摘要，60-120 字，明确说明主题、关键信息和影响。",
    "3. content 写成中文短内容，250-500 字，允许使用少量 Markdown 小标题或列表。",
    "4. content 要体现：发生了什么、为什么重要、有哪些关键细节或限制。",
    "5. tags 返回 3-5 个简短标签，尽量与主题、来源类型、技术方向相关。",
    "6. sourceNote 用 1 句话说明来源和发布前需要核对的点。",
    "7. 不要加入原文没有的信息，不要抄袭原文整段内容。",
    "",
    `来源：${input.sourceName}`,
    `来源类型：${input.sourceType}`,
    `原标题：${input.title}`,
    `作者：${input.author || "未知"}`,
    `发布时间：${input.publishedAt || "未知"}`,
    `链接：${input.url}`,
    `抓取摘要：${input.summary || "无"}`,
    `抓取片段：${sourceText || "无"}`
  ].join("\n");

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];
}

export async function generateShortChineseArticle(
  bindings: AiContentBindings,
  input: AiContentInput
): Promise<GeneratedArticleContent> {
  const articleText = cleanText(input.articleText || "");
  if (!articleText) {
    return buildNoArticleContent(input);
  }

  if (!bindings.OPENAI_API_KEY || Date.now() < aiUnavailableUntil) {
    return buildFallbackContent(input);
  }

  const baseUrl = (bindings.OPENAI_BASE_URL || bindings.OPENAI_API_BASE || "https://api.openai.com/v1").replace(
    /\/+$/,
    ""
  );
  const model = bindings.OPENAI_MODEL || "gpt-4o-mini";
  const timeoutMs = resolveTimeoutMs(bindings);
  const messages = buildAiContentMessages(input, articleText);

  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${bindings.OPENAI_API_KEY}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          response_format: { type: "json_object" },
          messages
        })
      },
      timeoutMs
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`AI content request failed: ${response.status} ${message}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };
    
    const content = payload.choices?.[0]?.message?.content || "";
    return normalizeAiOutput(parseJsonObject(content), input, model);
  } catch (error) {
    aiUnavailableUntil = Date.now() + AI_COOLDOWN_MS;
    console.error("AI content generation failed, falling back to local draft", {
      message: error instanceof Error ? error.message : String(error),
      timeoutMs,
      source: input.sourceName,
      title: input.title
    });
    return buildFallbackContent(input);
  }
}
