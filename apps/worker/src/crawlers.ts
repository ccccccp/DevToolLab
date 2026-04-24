import { decodeHtmlEntities } from "@devtoollab/shared";

type SourceInput = {
  id: string;
  name: string;
  parserKey: string;
  baseUrl: string;
  feedUrl: string;
};

export type FetchedItem = {
  externalId?: string;
  title: string;
  url: string;
  author?: string;
  summary?: string;
  contentSnippet?: string;
  publishedAt?: string | null;
};

function stripHtml(value: string) {
  const stripped = value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(stripped).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function decodeXml(value: string) {
  return stripHtml(value);
}

function extractTag(block: string, tagName: string) {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function absoluteUrl(baseUrl: string, maybeUrl: string) {
  try {
    return new URL(maybeUrl, baseUrl).toString();
  } catch {
    return maybeUrl;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "user-agent": "DevToolLabBot/0.1"
    }
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${url}`);
  }
  return (await response.json()) as T;
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "DevToolLabBot/0.1"
    }
  });
  if (!response.ok) {
    throw new Error(`Fetch failed ${response.status} for ${url}`);
  }
  return response.text();
}

async function crawlHackerNews(source: SourceInput): Promise<FetchedItem[]> {
  const ids = await fetchJson<number[]>(source.feedUrl || "https://hacker-news.firebaseio.com/v0/topstories.json");
  const topIds = ids.slice(0, 10);
  const items = await Promise.all(
    topIds.map(async (id) => {
      const item = await fetchJson<{
        id: number;
        title?: string;
        url?: string;
        by?: string;
        time?: number;
        text?: string;
      }>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);

      const url = item.url || `https://news.ycombinator.com/item?id=${item.id}`;
      return {
        externalId: String(item.id),
        title: item.title || `HN Item ${item.id}`,
        url,
        author: item.by || "unknown",
        summary: stripHtml(item.text || ""),
        contentSnippet: stripHtml(item.text || ""),
        publishedAt: item.time ? new Date(item.time * 1000).toISOString() : null
      } satisfies FetchedItem;
    })
  );

  return items;
}

function parseRssItems(source: SourceInput, xml: string): FetchedItem[] {
  const itemBlocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const entryBlocks = xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ?? [];
  const blocks = (itemBlocks.length > 0 ? itemBlocks : entryBlocks).slice(0, 10);

  return blocks.map((block, index) => {
    const link =
      extractTag(block, "link") ||
      block.match(/<link[^>]*href="([^"]+)"/i)?.[1] ||
      source.baseUrl;

    const description =
      extractTag(block, "description") ||
      extractTag(block, "summary") ||
      extractTag(block, "content");

    return {
      externalId: extractTag(block, "guid") || extractTag(block, "id") || String(index + 1),
      title: extractTag(block, "title") || `RSS Item ${index + 1}`,
      url: absoluteUrl(source.baseUrl, link),
      author: extractTag(block, "dc:creator") || extractTag(block, "author"),
      summary: description.slice(0, 300),
      contentSnippet: description.slice(0, 1000),
      publishedAt:
        extractTag(block, "pubDate") ||
        extractTag(block, "published") ||
        extractTag(block, "updated") ||
        null
    } satisfies FetchedItem;
  });
}

async function crawlRss(source: SourceInput): Promise<FetchedItem[]> {
  const xml = await fetchText(source.feedUrl);
  return parseRssItems(source, xml);
}

async function crawlAnthropicNewsroom(source: SourceInput): Promise<FetchedItem[]> {
  const html = await fetchText(source.feedUrl || `${source.baseUrl}/news`);
  const matches = [...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const items: FetchedItem[] = [];

  for (const match of matches) {
    const href = match[1];
    const text = stripHtml(match[2]);

    if (!href.startsWith("/news/") || text.length < 20) {
      continue;
    }

    const url = absoluteUrl(source.baseUrl, href);
    if (items.some((item) => item.url === url)) {
      continue;
    }

    items.push({
      externalId: href,
      title: text,
      url,
      author: source.name,
      summary: text,
      contentSnippet: text,
      publishedAt: null
    });

    if (items.length >= 10) {
      break;
    }
  }

  return items;
}

async function crawlProductHunt(source: SourceInput): Promise<FetchedItem[]> {
  const xml = await fetchText(source.feedUrl || "https://www.producthunt.com/feed");
  const items = parseRssItems(source, xml);

  return items.map((item) => {
    // Product Hunt titles are usually "Name - Slogan"
    const [name, ...sloganParts] = item.title.split(" - ");
    const slogan = sloganParts.join(" - ");

    return {
      ...item,
      title: name.trim(),
      summary: slogan || item.summary,
      author: "Product Hunt"
    };
  });
}

export async function crawlSource(source: SourceInput): Promise<FetchedItem[]> {
  switch (source.parserKey) {
    case "hn-top":
      return crawlHackerNews(source);
    case "rss-standard":
      return crawlRss(source);
    case "anthropic-newsroom":
      return crawlAnthropicNewsroom(source);
    case "product-hunt":
      return crawlProductHunt(source);
    default:
      throw new Error(`Unsupported parserKey: ${source.parserKey}`);
  }
}
