export type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type ChatCompletionInput = {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  messages: ChatMessage[];
  temperature?: number;
  responseFormatJson?: boolean;
};

export function parseJsonObject(value: string) {
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

export async function callChatCompletion(input: ChatCompletionInput) {
  const response = await fetchWithTimeout(
    `${input.baseUrl.replace(/\/+$/, "")}/chat/completions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: input.model,
        temperature: input.temperature ?? 0.2,
        ...(input.responseFormatJson ? { response_format: { type: "json_object" } } : {}),
        messages: input.messages
      })
    },
    input.timeoutMs
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`AI request failed: ${response.status} ${message}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return payload.choices?.[0]?.message?.content || "";
}
