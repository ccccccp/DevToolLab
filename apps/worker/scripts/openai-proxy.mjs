import http from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { ProxyAgent, setGlobalDispatcher } from "undici";

const port = Number.parseInt(process.env.OPENAI_PROXY_PORT || "8788", 10);
const upstreamBaseUrl = (process.env.OPENAI_UPSTREAM_BASE_URL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(
  /\/+$/,
  ""
);
const defaultApiKey = process.env.OPENAI_API_KEY || "";
const PROXY_URL = process.env.OPENAI_CONNECTIVITY_PROXY || "";
const responseDumpDir = new URL("../.openai-proxy-responses/", import.meta.url);

if (PROXY_URL) {
  setGlobalDispatcher(new ProxyAgent(PROXY_URL));
} else {
  console.warn(
    "No connectivity proxy configured. To enable, set the OPENAI_CONNECTIVITY_PROXY environment variable to the URL of your proxy server."
  );
}

process.title = "ai-proxy";

function logEvent(event, details = {}) {
  console.log(
    JSON.stringify({
      level: "info",
      scope: "ai-proxy",
      event,
      timestamp: new Date().toISOString(),
      ...details
    })
  );
}

function logError(event, details = {}) {
  console.error(
    JSON.stringify({
      level: "error",
      scope: "ai-proxy",
      event,
      timestamp: new Date().toISOString(),
      ...details
    })
  );
}

function toTextPreview(buffer, maxLength = 99999999) {
  if (!buffer || buffer.length === 0) {
    return "";
  }

  return buffer.toString("utf8").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

async function persistResponseDump(details) {
  const id = `${Date.now()}-${randomUUID()}`;
  const filepath = new URL(`${id}.json`, responseDumpDir);

  await mkdir(responseDumpDir, { recursive: true });
  await writeFile(filepath, `${JSON.stringify(details, null, 2)}\n`, "utf8");

  return filepath;
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    request.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    request.on("error", reject);
  });
}

function buildForwardHeaders(request, body) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(request.headers)) {
    if (!value || key.toLowerCase() === "host" || key.toLowerCase() === "content-length") {
      continue;
    }

    headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }

  if (!headers.has("authorization") && defaultApiKey) {
    headers.set("authorization", `Bearer ${defaultApiKey}`);
  }

  if (body.length > 0 && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return headers;
}

function buildResponseHeaders(upstreamResponse, responseBuffer) {
  const headers = {};

  for (const [key, value] of upstreamResponse.headers.entries()) {
    const normalizedKey = key.toLowerCase();

    if (
      normalizedKey === "content-length" ||
      normalizedKey === "transfer-encoding" ||
      normalizedKey === "content-encoding" ||
      normalizedKey === "connection" ||
      normalizedKey === "keep-alive"
    ) {
      continue;
    }

    headers[key] = value;
  }

  headers["content-length"] = String(responseBuffer.length);

  return headers;
}

async function handleProxy(request, response) {
  const startedAt = Date.now();

  if (!request.url) {
    logError("request_rejected", {
      reason: "missing_request_url"
    });
    writeJson(response, 400, { ok: false, error: "Missing request URL" });
    return;
  }

  const requestUrl = new URL(request.url, `http://127.0.0.1:${port}`);

  if (requestUrl.pathname === "/health") {
    logEvent("health_check", {
      method: request.method || "GET",
      path: requestUrl.pathname
    });
    writeJson(response, 200, {
      ok: true,
      port,
      upstreamBaseUrl,
      apiKeyConfigured: Boolean(defaultApiKey)
    });
    return;
  }

  if (!requestUrl.pathname.startsWith("/v1/")) {
    logError("request_rejected", {
      method: request.method || "GET",
      path: requestUrl.pathname,
      reason: "unsupported_path"
    });
    writeJson(response, 404, {
      ok: false,
      error: "Only /v1/* paths are supported"
    });
    return;
  }

  const body = await readRequestBody(request);
  const upstreamUrl = new URL(requestUrl.pathname + requestUrl.search, `${upstreamBaseUrl}/`).toString();
  const requestPreview = toTextPreview(body);
  const requestId = randomUUID();

  logEvent("request_received", {
    requestId,
    method: request.method || "GET",
    path: requestUrl.pathname,
    search: requestUrl.search,
    upstreamUrl,
    bodyBytes: body.length,
    bodyPreview: requestPreview
  });

  try {
    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method || "GET",
      headers: buildForwardHeaders(request, body),
      body: body.length > 0 ? body : undefined
    });

    const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
    const responseHeaders = buildResponseHeaders(upstreamResponse, responseBuffer);
    const responsePreview = toTextPreview(responseBuffer);
    const responseText = responseBuffer.toString("utf8");
    const contentType = upstreamResponse.headers.get("content-type") || "";
    let parsedResponse = null;

    if (contentType.includes("application/json")) {
      try {
        parsedResponse = JSON.parse(responseText);
      } catch {
        parsedResponse = null;
      }
    }

    const dumpPath = await persistResponseDump({
      requestId,
      timestamp: new Date().toISOString(),
      method: request.method || "GET",
      path: requestUrl.pathname,
      search: requestUrl.search,
      upstreamUrl,
      status: upstreamResponse.status,
      ok: upstreamResponse.ok,
      durationMs: Date.now() - startedAt,
      requestBodyPreview: requestPreview,
      responseHeaders,
      responseText,
      responseJson: parsedResponse
    });

    logEvent("request_completed", {
      requestId,
      method: request.method || "GET",
      path: requestUrl.pathname,
      upstreamUrl,
      status: upstreamResponse.status,
      ok: upstreamResponse.ok,
      durationMs: Date.now() - startedAt,
      responseBytes: responseBuffer.length,
      responsePreview,
      dumpPath: dumpPath.pathname
    });

    response.writeHead(upstreamResponse.status, responseHeaders);
    response.end(responseBuffer);
  } catch (error) {
    logError("request_failed", {
      requestId,
      method: request.method || "GET",
      path: requestUrl.pathname,
      upstreamUrl,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error)
    });
    writeJson(response, 502, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      upstreamUrl
    });
  }
}

const server = http.createServer((request, response) => {
  void handleProxy(request, response);
});

server.listen(port, "127.0.0.1", () => {
  logEvent("server_started", {
    port,
    PROXY_URL: PROXY_URL,
    serverUrl: `http://127.0.0.1:${port}/`,
    upstreamBaseUrl,
    apiKeyConfigured: Boolean(defaultApiKey)
  });
});
