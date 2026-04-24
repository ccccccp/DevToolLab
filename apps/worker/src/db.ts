import type { SqlRow } from "./types";

export function nowIso() {
  return new Date().toISOString();
}

export function asBoolean(value: unknown) {
  return Number(value) === 1;
}

export function asArray(value: unknown) {
  if (typeof value !== "string" || !value) {
    return [] as string[];
  }

  return JSON.parse(value) as string[];
}

export function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

export function normalizeUrl(value: string) {
  try {
    return new URL(value).toString();
  } catch {
    return value.trim();
  }
}

export function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

export async function run<T extends SqlRow>(
  db: D1Database,
  sql: string,
  bindings: unknown[] = []
): Promise<T[]> {
  const result = await db.prepare(sql).bind(...bindings).all<T>();
  return result.results ?? [];
}

export async function first<T extends SqlRow>(
  db: D1Database,
  sql: string,
  bindings: unknown[] = []
): Promise<T | null> {
  const result = await db.prepare(sql).bind(...bindings).first<T>();
  return result ?? null;
}

export async function exec(db: D1Database, sql: string, bindings: unknown[] = []) {
  return db.prepare(sql).bind(...bindings).run();
}

export async function uniqueSlug(
  db: D1Database,
  table: "posts" | "tools" | "sources",
  desired: string,
  currentSlug?: string
) {
  const fallback = desired || `${table.slice(0, -1)}-${crypto.randomUUID().slice(0, 8)}`;
  
  // Check if the exact slug exists first
  const exactMatch = await first<{ slug: string }>(db, `SELECT slug FROM ${table} WHERE slug = ?`, [
    fallback
  ]);

  if (!exactMatch || fallback === currentSlug) {
    return fallback;
  }

  // If exists, find all related slugs to determine the next available number
  const rows = await run<{ slug: string }>(db, `SELECT slug FROM ${table} WHERE slug LIKE ?`, [
    `${fallback}-%`
  ]);
  const existing = rows.map((row) => row.slug);

  let count = 2;
  let candidate = `${fallback}-${count}`;
  while (existing.includes(candidate) && candidate !== currentSlug) {
    count += 1;
    candidate = `${fallback}-${count}`;
  }

  return candidate;
}
