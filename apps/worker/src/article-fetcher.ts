export type ArticleExtractionStatus = "success" | "skipped" | "failed";

export type ArticleExtractionResult = {
  status: ArticleExtractionStatus;
  url: string;
  text: string;
  excerpt: string;
  errorMessage?: string;
};

const ARTICLE_FETCH_TIMEOUT_MS = 7_000;
const MAX_ARTICLE_TEXT_LENGTH = 16_000;
const MAX_EXCERPT_LENGTH = 1_200;

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function decodeHtmlEntities(value: string) {
  const htmlEntityMap: Record<string, string> = {
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

    const named = htmlEntityMap[entity.slice(1, -1)];
    return named ?? entity;
  });
}

function isFetchableUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchTextWithTimeout(url: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(`timeout:${ARTICLE_FETCH_TIMEOUT_MS}`), ARTICLE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "DevToolLabBot/0.1"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Article fetch failed ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new Error(`Unsupported content type: ${contentType}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

function removeNoisyHtml(html: string) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<form\b[\s\S]*?<\/form>/gi, " ")
    .replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, " ");
}

function extractCandidateHtml(html: string) {
  const candidates = [
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<body\b[^>]*>([\s\S]*?)<\/body>/i
  ];

  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return html;
}

function htmlToText(html: string) {
  const withBreaks = html
    .replace(/<(h[1-6]|p|li|blockquote|pre|div|section)\b[^>]*>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(h[1-6]|p|li|blockquote|pre|div|section)>/gi, "\n");

  const stripped = withBreaks.replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(stripped).replace(/\u00a0/g, " ");

  return decoded
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 20)
    .filter((line, index, lines) => lines.indexOf(line) === index)
    .join("\n\n")
    .trim();
}

export async function fetchArticleContent(url: string): Promise<ArticleExtractionResult> {
  if (!isFetchableUrl(url)) {
    return {
      status: "skipped",
      url,
      text: "",
      excerpt: "",
      errorMessage: "URL is not fetchable"
    };
  }

  try {
    const html = await fetchTextWithTimeout(url);
    const cleanedHtml = removeNoisyHtml(html);
    const candidateHtml = extractCandidateHtml(cleanedHtml);
    const text = truncate(htmlToText(candidateHtml), MAX_ARTICLE_TEXT_LENGTH);

    if (text.length < 120) {
      return {
        status: "failed",
        url,
        text,
        excerpt: truncate(text, MAX_EXCERPT_LENGTH),
        errorMessage: "Extracted article text is too short"
      };
    }

    return {
      status: "success",
      url,
      text,
      excerpt: truncate(text, MAX_EXCERPT_LENGTH)
    };
  } catch (error) {
    return {
      status: "failed",
      url,
      text: "",
      excerpt: "",
      errorMessage: error instanceof Error ? error.message : String(error)
    };
  }
}
