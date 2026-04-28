export type AiProviderName = "openai" | "deepseek" | "grok";

export type AiRuntimeEnv = {
  AI_PROVIDER?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
  OPENAI_TIMEOUT_MS?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_MODEL?: string;
  DEEPSEEK_TIMEOUT_MS?: string;
  XAI_API_KEY?: string;
  XAI_BASE_URL?: string;
  XAI_MODEL?: string;
  XAI_TIMEOUT_MS?: string;
};

export type ResolvedAiConfig = {
  provider: AiProviderName;
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
};

type ResolvedAiSnapshot = {
  provider: AiProviderName;
  baseUrl: string;
  model: string;
  timeoutMs: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
};

function normalizeProvider(value: string | undefined): AiProviderName {
  const provider = String(value || "").trim().toLowerCase();

  if (provider === "deepseek") {
    return "deepseek";
  }

  if (provider === "grok" || provider === "xai" || provider === "x-ai") {
    return "grok";
  }

  return "openai";
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

function resolveProviderFromEnv(env: AiRuntimeEnv): AiProviderName {
  return normalizeProvider(env.AI_PROVIDER);
}

function defaultBaseUrl(provider: AiProviderName) {
  switch (provider) {
    case "deepseek":
      return "https://api.deepseek.com/v1";
    case "grok":
      return "https://api.x.ai/v1";
    case "openai":
    default:
      return "https://api.openai.com/v1";
  }
}

function defaultModel(provider: AiProviderName) {
  switch (provider) {
    case "deepseek":
      return "deepseek-v4-flash";
    case "grok":
      return "grok-4";
    case "openai":
    default:
      return "gpt-4o-mini";
  }
}

function resolveTimeoutMs(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function selectProviderConfig(env: AiRuntimeEnv, provider: AiProviderName) {
  switch (provider) {
    case "deepseek":
      return {
        apiKey: env.DEEPSEEK_API_KEY,
        baseUrl: env.DEEPSEEK_BASE_URL,
        model: env.DEEPSEEK_MODEL,
        timeoutMs: env.DEEPSEEK_TIMEOUT_MS
      };
    case "grok":
      return {
        apiKey: env.XAI_API_KEY,
        baseUrl: env.XAI_BASE_URL,
        model: env.XAI_MODEL,
        timeoutMs: env.XAI_TIMEOUT_MS
      };
    case "openai":
    default:
      return {
        apiKey: env.OPENAI_API_KEY,
        baseUrl: env.OPENAI_BASE_URL,
        model: env.OPENAI_MODEL,
        timeoutMs: env.OPENAI_TIMEOUT_MS
      };
  }
}

export function resolveAiConfig(
  env: AiRuntimeEnv,
  options: {
    defaultTimeoutMs: number;
  }
): ResolvedAiConfig {
  const provider = resolveProviderFromEnv(env);
  const providerConfig = selectProviderConfig(env, provider);

  return {
    provider,
    apiKey: providerConfig.apiKey?.trim() || "",
    baseUrl: (providerConfig.baseUrl || defaultBaseUrl(provider)).replace(/\/+$/, ""),
    model: providerConfig.model?.trim() || defaultModel(provider),
    timeoutMs: resolveTimeoutMs(providerConfig.timeoutMs, options.defaultTimeoutMs)
  };
}

export function describeAiRuntimeEnv(env: AiRuntimeEnv): ResolvedAiSnapshot {
  const config = resolveAiConfig(env, { defaultTimeoutMs: 0 });
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    timeoutMs: String(config.timeoutMs || ""),
    apiKeyConfigured: Boolean(config.apiKey),
    apiKeyMasked: maskSecret(config.apiKey)
  };
}
