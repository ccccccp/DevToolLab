import assert from "node:assert/strict";
import { lookup, resolve4, resolve6 } from "node:dns/promises";
import { ProxyAgent, setGlobalDispatcher } from "undici";

const DEFAULT_OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "http://127.0.0.1:8788/v1").replace(/\/+$/, "");
const TARGET_HOST = process.env.OPENAI_CONNECTIVITY_HOST || "127.0.0.1";
const TARGET_URL = process.env.OPENAI_CONNECTIVITY_URL || `${DEFAULT_OPENAI_BASE_URL}/models`;
const CONNECT_TIMEOUT_MS = Number.parseInt(process.env.OPENAI_CONNECT_TIMEOUT_MS ?? "8000", 10);
const PROXY_URL = process.env.OPENAI_CONNECTIVITY_PROXY || "";

async function fetchWithTimeout(url: string, timeoutMs: number, init?: RequestInit) {
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

async function main() {
  if (PROXY_URL) {
    setGlobalDispatcher(new ProxyAgent(PROXY_URL));
  }

  const lookupResult = await lookup(TARGET_HOST, { all: true });
  const ipv4 = await resolve4(TARGET_HOST).catch(() => []);
  const ipv6 = await resolve6(TARGET_HOST).catch(() => []);

  const headers: Record<string, string> = {
    accept: "application/json",
    "user-agent": "DevToolLabBot/0.1"
  };

  if (process.env.OPENAI_API_KEY) {
    headers.authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(TARGET_URL, CONNECT_TIMEOUT_MS, {
      method: "GET",
      headers
    });
  } catch (error) {
    const cause = error instanceof Error ? (error as Error & { cause?: { code?: string; message?: string } }).cause : undefined;
    console.error(
      JSON.stringify({
        stage: "fetch",
        host: TARGET_HOST,
        url: TARGET_URL,
        timeoutMs: CONNECT_TIMEOUT_MS,
        dns: lookupResult,
        ipv4,
        ipv6,
        error: error instanceof Error ? error.message : String(error),
        causeCode: cause?.code,
        causeMessage: cause?.message
      })
    );
    throw error;
  }

  const bodyText = await response.text().catch(() => "");
  const bodyPreview = bodyText.slice(0, 240);

  assert.ok(lookupResult.length > 0, `Expected DNS lookup result for ${TARGET_HOST}`);
  assert.ok(
    response.status > 0,
    `Expected an HTTP response from ${TARGET_URL}, got status ${response.status}`
  );

  console.log(
    JSON.stringify({
      host: TARGET_HOST,
      url: TARGET_URL,
      timeoutMs: CONNECT_TIMEOUT_MS,
      proxyUrl: PROXY_URL,
      dns: lookupResult,
      ipv4,
      ipv6,
      httpStatus: response.status,
      httpOk: response.ok,
      responsePreview: bodyPreview
    })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
