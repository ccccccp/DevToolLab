import type { AiRuntimeEnv } from "./ai-config";

export type Env = {
  DB: D1Database;
  DEVTOOLLAB_WORKER_API_SECRET?: string;
} & AiRuntimeEnv;

export type SqlRow = Record<string, unknown>;
