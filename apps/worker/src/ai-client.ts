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
    console.error("AI_JSON_PARSE_ERROR", {
      rawLength: value.length,
      cleanedPreview: cleaned.slice(0, 100)
    });
    throw new Error(`AI response is not a JSON object: ${cleaned.slice(0, 50)}...`);
  }

  try {
    const jsonStr = cleaned.slice(start, end + 1);
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch (error) {
    console.error("AI_JSON_PARSE_EXCEPTION", {
      error: error instanceof Error ? error.message : String(error),
      jsonPreview: cleaned.slice(start, start + 50)
    });
    throw error;
  }
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
  const startTime = Date.now();
  const url = `${input.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  
  console.info("AI_REQUEST_START", {
    model: input.model,
    url,
    messageCount: input.messages.length,
    hasJsonFormat: Boolean(input.responseFormatJson),
    apiKey:input.apiKey ? `${input.apiKey.slice(0, 4)}***${input.apiKey.slice(-4)}` : ""
  });

  try {
    const response = await fetchWithTimeout(
      url,
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

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI_REQUEST_ERROR", {
        status: response.status,
        duration,
        error: errorText
      });
      throw new Error(`AI request failed: ${response.status} ${errorText}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
      usage?: Record<string, unknown>;
    };

    const content = payload.choices?.[0]?.message?.content || "";
    
    console.info("AI_REQUEST_SUCCESS", {
      duration,
      contentLength: content.length,
      usage: payload.usage
    });

    return content;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("AI_REQUEST_EXCEPTION", {
      duration,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
