type SummaryBindings = {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_API_BASE?: string;
  OPENAI_MODEL?: string;
  OPENAI_TIMEOUT_MS?: string;
};

type SummaryInput = {
  sourceName: string;
  title: string;
  url: string;
  author?: string;
  summary?: string;
  contentSnippet?: string;
  publishedAt?: string | null;
};

const DEFAULT_OPENAI_TIMEOUT_MS = 2500;
const AI_COOLDOWN_MS = 60_000;

let aiUnavailableUntil = 0;

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function fallbackChineseSummary(input: SummaryInput) {
  const raw = cleanText(input.summary || input.contentSnippet || "");
  if (!raw) {
    return `这条内容来自${input.sourceName}，主题是“${input.title}”。发布前请结合原文链接核对事实、时间和上下文后再完善正文。`;
  }

  const shortened = truncate(raw, 88);
  return `这条内容来自${input.sourceName}，核心信息是：${shortened}。发布前请核对原文细节并补充你的中文编辑判断。`;
}

function resolveTimeoutMs(bindings: SummaryBindings) {
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

export async function generateChineseSummary(bindings: SummaryBindings, input: SummaryInput) {
  if (!bindings.OPENAI_API_KEY) {
    return fallbackChineseSummary(input);
  }

  if (Date.now() < aiUnavailableUntil) {
    return fallbackChineseSummary(input);
  }

  const baseUrl = (bindings.OPENAI_BASE_URL || bindings.OPENAI_API_BASE || "https://api.openai.com/v1").replace(
    /\/+$/,
    ""
  );
  const model = bindings.OPENAI_MODEL || "gpt-4o-mini";
  const timeoutMs = resolveTimeoutMs(bindings);
  const prompt = [
    "请基于下面的抓取信息生成一段简体中文摘要。",
    "要求：",
    "1. 只输出一段中文，不要使用 Markdown。",
    "2. 长度控制在 80 到 140 个汉字。",
    "3. 不要虚构原文没有的信息。",
    "4. 如果信息不足，就明确说明信息有限。",
    "",
    `来源：${input.sourceName}`,
    `标题：${input.title}`,
    `作者：${input.author || "未知"}`,
    `发布时间：${input.publishedAt || "未知"}`,
    `原文链接：${input.url}`,
    `抓取摘要：${input.summary || "无"}`,
    `抓取片段：${input.contentSnippet || "无"}`
  ].join("\n");

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
          messages: [
            {
              role: "system",
              content: "你是内容运营编辑助手，只能根据提供的信息输出准确、简洁的简体中文摘要。"
            },
            {
              role: "user",
              content: prompt
            }
          ]
        })
      },
      timeoutMs
    );

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`AI summary request failed: ${response.status} ${message}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = cleanText(payload.choices?.[0]?.message?.content || "");
    return content || fallbackChineseSummary(input);
  } catch (error) {
    aiUnavailableUntil = Date.now() + AI_COOLDOWN_MS;
    console.error("AI summary failed, falling back to local summary", {
      message: error instanceof Error ? error.message : String(error),
      timeoutMs,
      source: input.sourceName,
      title: input.title
    });
    return fallbackChineseSummary(input);
  }
}
