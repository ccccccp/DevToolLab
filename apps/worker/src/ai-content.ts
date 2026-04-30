import { callChatCompletion, parseJsonObject, type ChatMessage } from "./ai-client";
import { makeAiCooldownKey, isAiCoolingDown, markAiCoolingDown } from "./ai-runtime";
import { resolveAiConfig, type AiRuntimeEnv } from "./ai-config";

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

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_INPUT_TEXT_LENGTH = 12_000;
const MAX_TAGS = 5;

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
    return `\u5185\u5bb9\u6765\u81ea ${input.sourceName}\uff0c\u6838\u5fc3\u4fe1\u606f\u662f\uff1a${truncate(raw, 120)}`;
  }

  return `\u5185\u5bb9\u6765\u81ea ${input.sourceName}\uff0c\u5f53\u524d\u4ec5\u6293\u53d6\u5230\u6807\u9898\uff0c\u53d1\u5e03\u524d\u9700\u8981\u8865\u5145\u539f\u6587\u4fe1\u606f\u3002`;
}

function buildFallbackContent(input: AiContentInput): GeneratedArticleContent {
  const summary = buildFallbackSummary(input);
  const content = [
    "## \u6838\u5fc3\u6458\u8981",
    summary,
    "",
    "## \u91cd\u70b9\u4fe1\u606f",
    `- \u6765\u6e90\uff1a${input.sourceName}`,
    `- \u539f\u6587\uff1a${input.url}`,
    input.publishedAt ? `- \u53d1\u5e03\u65f6\u95f4\uff1a${input.publishedAt}` : "- \u53d1\u5e03\u65f6\u95f4\uff1a\u672a\u77e5",
    "",
    "## \u7f16\u8f91\u63d0\u9192",
    "\u6b63\u6587\u6293\u53d6\u6216 AI \u751f\u6210\u5185\u5bb9\u4e0d\u5b8c\u5168\u53ef\u9760\uff0c\u53d1\u5e03\u524d\u8bf7\u4eba\u5de5\u6838\u5bf9\u539f\u6587\u3001\u8865\u5145\u80cc\u666f\uff0c\u5e76\u786e\u8ba4\u6765\u6e90\u6388\u6743\u8fb9\u754c\u3002"
  ].join("\n");

  return {
    title: input.title,
    summary: truncate(summary, 240),
    content,
    tags: [input.sourceType, "ai"],
    sourceNote: `\u5185\u5bb9\u57fa\u4e8e ${input.sourceName} \u7684\u516c\u5f00\u4fe1\u606f\u751f\u6210\uff0c\u53d1\u5e03\u524d\u8bf7\u6838\u5bf9\u539f\u6587\u3002`,
    model: "fallback",
    usedFallback: true
  };
}

function buildNoArticleContent(input: AiContentInput): GeneratedArticleContent {
  return {
    title: input.title,
    summary: "\u65e0",
    content: "\u65e0",
    tags: [input.sourceType, "no-content"],
    sourceNote: `\u672a\u6293\u53d6\u5230\u6b63\u6587\uff0c\u4ec5\u4fdd\u7559\u6765\u6e90\u4fe1\u606f\uff1a${input.sourceName}\u3002`,
    model: "no-content",
    usedFallback: true
  };
}

function buildMessages(input: AiContentInput, articleText: string): ChatMessage[] {
  const sourceText = truncate(articleText || input.contentSnippet || input.summary || "", MAX_INPUT_TEXT_LENGTH);

  const userPrompt = [
    "\u8bf7\u57fa\u4e8e\u4e0b\u9762\u7684\u6293\u53d6\u5185\u5bb9\u751f\u6210\u4e00\u7bc7\u9002\u5408\u4eba\u5de5\u5ba1\u6838\u53d1\u5e03\u7684\u4e2d\u6587\u77ed\u6587\u3002",
    "\u8981\u6c42\uff1a",
    "1. \u53ea\u8f93\u51fa JSON\uff0c\u4e14\u53ea\u5305\u542b title\u3001summary\u3001content\u3001tags\u3001sourceNote \u8fd9\u51e0\u4e2a\u5b57\u6bb5\u3002",
    "2. summary \u5199\u6210 1 \u6bb5\u4e2d\u6587\u6458\u8981\uff0c60-120 \u5b57\uff0c\u660e\u786e\u8bf4\u660e\u4e3b\u9898\u3001\u5173\u952e\u4fe1\u606f\u548c\u5f71\u54cd\u3002",
    "3. content \u5199\u6210\u4e2d\u6587\u77ed\u5185\u5bb9\uff0c250-500 \u5b57\uff0c\u53ef\u4ee5\u4f7f\u7528\u5c11\u91cf Markdown \u5c0f\u6807\u9898\u6216\u5217\u8868\u3002",
    "4. content \u8981\u4f53\u73b0\uff1a\u53d1\u751f\u4e86\u4ec0\u4e48\u3001\u4e3a\u4ec0\u4e48\u91cd\u8981\u3001\u6709\u54ea\u4e9b\u5173\u952e\u7ec6\u8282\u6216\u9650\u5236\u3002",
    "5. tags \u8fd4\u56de 3-5 \u4e2a\u7b80\u77ed\u6807\u7b7e\uff0c\u5c3d\u91cf\u4e0e\u4e3b\u9898\u3001\u6765\u6e90\u7c7b\u578b\u3001\u6280\u672f\u65b9\u5411\u76f8\u5173\u3002",
    "6. sourceNote \u7528 1 \u53e5\u8bdd\u8bf4\u660e\u6765\u6e90\u548c\u53d1\u5e03\u524d\u9700\u8981\u6838\u5bf9\u7684\u70b9\u3002",
    "7. \u4e0d\u8981\u52a0\u5165\u539f\u6587\u6ca1\u6709\u7684\u4fe1\u606f\uff0c\u4e0d\u8981\u62f7\u8d1d\u539f\u6587\u6574\u6bb5\u5185\u5bb9\u3002",
    "",
    `\u6765\u6e90\uff1a${input.sourceName}`,
    `\u6765\u6e90\u7c7b\u578b\uff1a${input.sourceType}`,
    `\u539f\u6807\u9898\uff1a${input.title}`,
    `\u4f5c\u8005\uff1a${input.author || "\u672a\u77e5"}`,
    `\u53d1\u5e03\u65f6\u95f4\uff1a${input.publishedAt || "\u672a\u77e5"}`,
    `\u94fe\u63a5\uff1a${input.url}`,
    `\u6293\u53d6\u6458\u8981\uff1a${input.summary || "\u65e0"}`,
    `\u6293\u53d6\u7247\u6bb5\uff1a${sourceText || "\u65e0"}`
  ].join("\n");

  return [
    {
      role: "system",
      content: "\u4f60\u662f\u5185\u5bb9\u7ad9\u7684\u4e2d\u6587\u7f16\u8f91\u52a9\u624b\u3002\u53ea\u80fd\u57fa\u4e8e\u63d0\u4f9b\u7684\u539f\u59cb\u6750\u6599\u5199\u4f5c\uff0c\u4e0d\u5f97\u7f16\u9020\u4e8b\u5b9e\u3002"
    },
    {
      role: "user",
      content: userPrompt
    }
  ];
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

export async function generateShortChineseArticle(
  bindings: AiRuntimeEnv,
  input: AiContentInput
): Promise<GeneratedArticleContent> {
  const articleText = cleanText(input.articleText || "");
  if (!articleText) {
    return buildNoArticleContent(input);
  }

  const ai = resolveAiConfig(bindings, { defaultTimeoutMs: DEFAULT_TIMEOUT_MS });
  if (!ai.apiKey) {
    return buildFallbackContent(input);
  }

  const cooldownKey = makeAiCooldownKey({ provider: ai.provider, baseUrl: ai.baseUrl, model: ai.model });
  if (isAiCoolingDown(cooldownKey)) {
    return buildFallbackContent(input);
  }

  try {
    const content = await callChatCompletion({
      baseUrl: ai.baseUrl,
      apiKey: ai.apiKey,
      model: ai.model,
      timeoutMs: ai.timeoutMs,
      messages: buildMessages(input, articleText),
      responseFormatJson: true
    });

    return normalizeAiOutput(parseJsonObject(content), input, ai.model);
  } catch (error) {
    markAiCoolingDown(cooldownKey);
    console.error("AI content generation failed, falling back to local draft", {
      message: error instanceof Error ? error.message : String(error),
      provider: ai.provider,
      baseUrl: ai.baseUrl,
      model: ai.model,
      timeoutMs: ai.timeoutMs,
      source: input.sourceName,
      title: input.title
    });
    return buildFallbackContent(input);
  }
}
