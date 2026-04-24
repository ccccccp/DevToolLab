import assert from "node:assert/strict";
import { ProxyAgent, setGlobalDispatcher } from "undici";

import { generateShortChineseArticle } from "../src/ai-content.ts";
import { fetchArticleContent } from "../src/article-fetcher.ts";

const RSS_URL = "https://openai.com/news/rss.xml";
const ARTICLE_TIMEOUT_MS = 20_000;
const OPENAI_SMOKE_TIMEOUT_MS = Number.parseInt(process.env.OPENAI_SMOKE_TIMEOUT_MS ?? "30000", 10);
const DEFAULT_OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || "http://127.0.0.1:8788/v1").replace(/\/+$/, "");
const PROXY_URL = process.env.OPENAI_CONNECTIVITY_PROXY || "";

function decodeHtmlEntities(value: string) {
  const entityMap: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " "
  };

  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (entity) => {
    if (entity.startsWith("&#x") || entity.startsWith("&#X")) {
      const codePoint = Number.parseInt(entity.slice(3, -1), 16);
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
    }

    if (entity.startsWith("&#")) {
      const codePoint = Number.parseInt(entity.slice(2, -1), 10);
      return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
    }

    const named = entityMap[entity.slice(1, -1)];
    return named ?? entity;
  });
}

function stripHtml(value: string) {
  return decodeHtmlEntities(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tagName: string) {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? stripHtml(match[1]) : "";
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(`timeout:${ARTICLE_TIMEOUT_MS}`), ARTICLE_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/rss+xml,application/xml,text/html",
        "user-agent": "DevToolLabBot/0.1"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Fetch failed ${response.status} for ${url}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseFirstRssItem(xml: string) {
  const itemBlock = xml.match(/<item\b[\s\S]*?<\/item>/i)?.[0];
  if (!itemBlock) {
    throw new Error("No RSS item found");
  }

  const link =
    extractTag(itemBlock, "link") ||
    itemBlock.match(/<link[^>]*href="([^"]+)"/i)?.[1] ||
    extractTag(itemBlock, "guid");
  const title = extractTag(itemBlock, "title") || "Untitled article";

  if (!link) {
    throw new Error("RSS item does not contain a usable article URL");
  }

  return {
    title,
    url: link
  };
}

async function getFirstOpenAiNewsItem() {
  const rssXml = await fetchText(RSS_URL);
  return parseFirstRssItem(rssXml);
}

async function main() {
  if (PROXY_URL) {
    setGlobalDispatcher(new ProxyAgent(PROXY_URL));
  }

  if (!process.env.OPENAI_API_KEY) {
    console.log("SKIP: OPENAI_API_KEY is not set, skipping live OpenAI smoke run.");
    return;
  }

  const item = await getFirstOpenAiNewsItem();
  const extraction = await fetchArticleContent(item.url);

  assert.equal(
    extraction.status,
    "success",
    `Expected article extraction to succeed, got ${extraction.status}${extraction.errorMessage ? `: ${extraction.errorMessage}` : ""}`
  );
  assert.ok(extraction.text.length > 300, `Expected extracted article text to be longer than 300 characters, got ${extraction.text.length}`);

  const openAiTimeoutMs =
    Number.isFinite(OPENAI_SMOKE_TIMEOUT_MS) && OPENAI_SMOKE_TIMEOUT_MS > 0 ? String(OPENAI_SMOKE_TIMEOUT_MS) : "30000";

  const generated = await generateShortChineseArticle(
    {
      ...process.env,
      OPENAI_BASE_URL: DEFAULT_OPENAI_BASE_URL,
      OPENAI_TIMEOUT_MS: openAiTimeoutMs
    },
    {
      sourceName: "OpenAI News",
      sourceType: "official-blog",
      title: item.title,
      url: item.url,
      summary: extraction.excerpt,
      contentSnippet: extraction.excerpt,
      articleText: extraction.text
    }
  );

  assert.equal(generated.usedFallback, false, "Expected live OpenAI output instead of fallback content");
  assert.ok(generated.summary.length >= 40, `Expected AI summary to be at least 40 characters, got ${generated.summary.length}`);
  assert.ok(generated.summary.length <= 160, `Expected AI summary to stay concise, got ${generated.summary.length} characters`);
  assert.ok(generated.content.length >= 120, `Expected AI content to be at least 120 characters, got ${generated.content.length}`);
  assert.ok(/\p{Script=Han}/u.test(generated.summary), "Expected AI summary to contain Chinese characters");
  assert.ok(/\p{Script=Han}/u.test(generated.content), "Expected AI content to contain Chinese characters");
  assert.ok(generated.tags.length > 0, "Expected AI tags to be populated");
  assert.ok(generated.sourceNote.length > 10, "Expected source note to be populated");

  console.log(
    JSON.stringify({
      sourceUrl: item.url,
      articleTitle: item.title,
      openAiBaseUrl: DEFAULT_OPENAI_BASE_URL,
      proxyUrl: PROXY_URL,
      extractionStatus: extraction.status,
      extractedLength: extraction.text.length,
      generatedTitle: generated.title,
      generatedSummary: generated.summary,
      generatedContentPreview: generated.content.slice(0, 280),
      generatedTags: generated.tags,
      usedFallback: generated.usedFallback
    })
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
