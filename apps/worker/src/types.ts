import type { AiRuntimeEnv } from "./ai-config";

export type Env = {
  DB: D1Database;
} & AiRuntimeEnv;

export type SqlRow = Record<string, unknown>;
