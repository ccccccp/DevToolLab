CREATE TABLE IF NOT EXISTS crawl_items (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  content_snippet TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  dedupe_hash TEXT NOT NULL UNIQUE,
  created_post_id TEXT,
  review_queue_id TEXT,
  fetched_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES crawl_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX IF NOT EXISTS idx_crawl_items_task_id ON crawl_items(task_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawl_items_source_id ON crawl_items(source_id, fetched_at DESC);

UPDATE sources
SET
  name = 'OpenAI News',
  slug = 'openai-news',
  type = 'official-blog',
  base_url = 'https://openai.com',
  feed_url = 'https://openai.com/news/rss.xml',
  status = 'active',
  enabled = 1,
  crawl_interval_minutes = 120,
  parser_key = 'rss-standard',
  notes = 'Official RSS feed for announcements and releases.',
  updated_at = '2026-04-22T12:00:00.000Z'
WHERE id = 'source_1';

UPDATE sources
SET
  name = 'Hacker News',
  slug = 'hacker-news',
  type = 'news',
  base_url = 'https://news.ycombinator.com',
  feed_url = 'https://hacker-news.firebaseio.com/v0/topstories.json',
  status = 'active',
  enabled = 1,
  crawl_interval_minutes = 30,
  parser_key = 'hn-top',
  notes = 'Public API for startup and open source news.',
  updated_at = '2026-04-22T12:00:00.000Z'
WHERE id = 'source_2';

UPDATE sources
SET
  name = 'Anthropic Newsroom',
  slug = 'anthropic-newsroom',
  type = 'official-blog',
  base_url = 'https://www.anthropic.com',
  feed_url = 'https://www.anthropic.com/news',
  status = 'active',
  enabled = 1,
  crawl_interval_minutes = 180,
  parser_key = 'anthropic-newsroom',
  notes = 'Official newsroom page for product and company updates.',
  updated_at = '2026-04-22T12:00:00.000Z'
WHERE id = 'source_3';
