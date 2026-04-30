import { callChatCompletion } from "./ai-client";
import { makeAiCooldownKey, isAiCoolingDown, markAiCoolingDown } from "./ai-runtime";
import { resolveAiConfig, type AiRuntimeEnv } from "./ai-config";

type SummaryInput = {
  sourceName: string;
  title: string;
  url: string;
  author?: string;
  summary?: string;
  contentSnippet?: string;
  publishedAt?: string | null;
};

const DEFAULT_TIMEOUT_MS = 30_000;

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function fallbackChineseSummary(input: SummaryInput) {
  const raw = cleanText(input.summary || input.contentSnippet || "");
  if (!raw) {
    return `\u8fd9\u6761\u5185\u5bb9\u6765\u81ea ${input.sourceName}\uff0c\u4e3b\u9898\u662f\u201c${input.title}\u201d\u3002\u53d1\u5e03\u524d\u8bf7\u7ed3\u5408\u539f\u6587\u94fe\u63a5\u6838\u5bf9\u4e8b\u5b9e\u3001\u65f6\u95f4\u548c\u4e0a\u4e0b\u6587\u540e\u518d\u5b8c\u5584\u6b63\u6587\u3002`;
  }

  const shortened = truncate(raw, 88);
  return `\u8fd9\u6761\u5185\u5bb9\u6765\u81ea ${input.sourceName}\uff0c\u6838\u5fc3\u4fe1\u606f\u662f\uff1a${shortened}\u3002\u53d1\u5e03\u524d\u8bf7\u6838\u5bf9\u539f\u6587\u7ec6\u8282\u5e76\u8865\u5145\u4f60\u7684\u4e2d\u6587\u7f16\u8f91\u5224\u65ad\u3002`;
}

function buildMessages(input: SummaryInput) {
  const userPrompt = [
    "\u8bf7\u57fa\u4e8e\u4e0b\u9762\u7684\u6293\u53d6\u4fe1\u606f\u751f\u6210\u4e00\u6bb5\u9002\u5408\u4eba\u5de5\u5ba1\u6838\u7684\u4e2d\u6587\u6458\u8981\u3002",
    "\u8981\u6c42\uff1a",
    "1. \u53ea\u8f93\u51fa\u4e00\u6bb5\u4e2d\u6587\uff0c\u4e0d\u8981\u4f7f\u7528 Markdown\u3002",
    "2. \u957f\u5ea6\u63a7\u5236\u5728 80 \u5230 140 \u4e2a\u6c49\u5b57\u3002",
    "3. \u4e0d\u8981\u865a\u6784\u539f\u6587\u6ca1\u6709\u7684\u4fe1\u606f\u3002",
    "4. \u4fe1\u606f\u4e0d\u8db3\u65f6\uff0c\u8981\u660e\u786e\u8bf4\u660e\u4fe1\u606f\u6709\u9650\u3002",
    "",
    `\u6765\u6e90\uff1a${input.sourceName}`,
    `\u6807\u9898\uff1a${input.title}`,
    `\u4f5c\u8005\uff1a${input.author || "\u672a\u77e5"}`,
    `\u53d1\u5e03\u65f6\u95f4\uff1a${input.publishedAt || "\u672a\u77e5"}`,
    `\u539f\u6587\u94fe\u63a5\uff1a${input.url}`,
    `\u6293\u53d6\u6458\u8981\uff1a${input.summary || "\u65e0"}`,
    `\u6293\u53d6\u7247\u6bb5\uff1a${input.contentSnippet || "\u65e0"}`
  ].join("\n");

  return [
    {
      role: "system" as const,
      content: "\u4f60\u662f\u5185\u5bb9\u8fd0\u8425\u7f16\u8f91\u52a9\u624b\uff0c\u53ea\u80fd\u57fa\u4e8e\u63d0\u4f9b\u7684\u4fe1\u606f\u5199\u4f5c\uff0c\u4e0d\u5f97\u7f16\u9020\u4e8b\u5b9e\u3002"
    },
    {
      role: "user" as const,
      content: userPrompt
    }
  ];
}

export async function generateChineseSummary(bindings: AiRuntimeEnv, input: SummaryInput) {
  const fallback = fallbackChineseSummary(input);
  const sourceText = cleanText(input.summary || input.contentSnippet || "");

  if (!sourceText) {
    return fallback;
  }

  const ai = resolveAiConfig(bindings, { defaultTimeoutMs: DEFAULT_TIMEOUT_MS });
  if (!ai.apiKey) {
    return fallback;
  }

  const cooldownKey = makeAiCooldownKey({ provider: ai.provider, baseUrl: ai.baseUrl, model: ai.model });
  if (isAiCoolingDown(cooldownKey)) {
    return fallback;
  }

  try {
    const content = cleanText(
      await callChatCompletion({
        baseUrl: ai.baseUrl,
        apiKey: ai.apiKey,
        model: ai.model,
        timeoutMs: ai.timeoutMs,
        messages: buildMessages(input)
      })
    );

    return content || fallback;
  } catch (error) {
    markAiCoolingDown(cooldownKey);
    console.error("AI summary failed, falling back to local summary", {
      message: error instanceof Error ? error.message : String(error),
      provider: ai.provider,
      baseUrl: ai.baseUrl,
      model: ai.model,
      timeoutMs: ai.timeoutMs,
      source: input.sourceName,
      title: input.title
    });
    return fallback;
  }
}
