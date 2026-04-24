export type Env = {
  DB: D1Database;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_API_BASE?: string;
  OPENAI_MODEL?: string;
  OPENAI_TIMEOUT_MS?: string;
};

export type SqlRow = Record<string, unknown>;
