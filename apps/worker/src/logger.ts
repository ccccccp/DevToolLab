import type { SqlRow } from "./types";

type LogDetails = Record<string, unknown>;

function readLocalProcessEnv() {
  return (globalThis as typeof globalThis & {
    process?: {
      env?: Record<string, string | undefined>;
    };
  }).process?.env;
}

function maskSecret(value: string | undefined) {
  if (!value) {
    return "";
  }

  if (value.length <= 8) {
    return "***";
  }

  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

async function writeLog(
  db: D1Database | undefined,
  method: "log" | "warn" | "error",
  scope: string,
  event: string,
  details: LogDetails = {}
) {
  const level = method === "log" ? "info" : method;
  const timestamp = new Date().toISOString();
  
  const payload = {
    level,
    scope,
    event,
    timestamp,
    ...details
  };

  console[method](JSON.stringify(payload));

  // If DB is provided and there's a task_id, persist to D1
  if (db && details.taskId) {
    try {
      const taskId = String(details.taskId);
      const message = details.errorMessage ? String(details.errorMessage) : `Event: ${event}`;
      
      // Clean up payload for DB storage (don't duplicate taskId)
      const dbPayload = { ...details };
      delete dbPayload.taskId;

      await db.prepare(`
        INSERT INTO crawl_logs (task_id, level, event_type, message, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        taskId,
        level,
        event,
        message,
        JSON.stringify(dbPayload),
        timestamp
      ).run();
    } catch (err) {
      console.error("Failed to persist log to D1", err);
    }
  }
}

export function logCrawlEvent(db: D1Database | undefined, event: string, details?: LogDetails) {
  writeLog(db, "log", "crawl", event, details);
}

export function logCrawlWarning(db: D1Database | undefined, event: string, details?: LogDetails) {
  writeLog(db, "warn", "crawl", event, details);
}

export function logCrawlError(db: D1Database | undefined, event: string, details?: LogDetails) {
  writeLog(db, "error", "crawl", event, details);
}

export function logRuntimeEnv(env: {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_API_BASE?: string;
  OPENAI_MODEL?: string;
  OPENAI_TIMEOUT_MS?: string;
}) {
  const processEnv = readLocalProcessEnv();
  const payload = {
    level: "info",
    scope: "runtime",
    event: "env_snapshot",
    timestamp: new Date().toISOString(),
    openAi: {
      baseUrl: env.OPENAI_BASE_URL || env.OPENAI_API_BASE || "https://api.openai.com/v1",
      model: env.OPENAI_MODEL || "gpt-4o-mini",
      timeoutMs: env.OPENAI_TIMEOUT_MS || "",
      apiKeyConfigured: Boolean(env.OPENAI_API_KEY),
      apiKeyMasked: maskSecret(env.OPENAI_API_KEY)
    },
    localProxy: {
      nodeUseEnvProxy: processEnv?.NODE_USE_ENV_PROXY || "",
      openAiConnectivityProxy: processEnv?.OPENAI_CONNECTIVITY_PROXY || "",
      httpProxy: processEnv?.HTTP_PROXY || "",
      httpsProxy: processEnv?.HTTPS_PROXY || "",
      noProxy: processEnv?.NO_PROXY || ""
    }
  };

  console.log(JSON.stringify(payload));
}

export function getErrorLogDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack
    };
  }

  return {
    errorMessage: String(error)
  };
}
