CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  source_name TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  editor_note TEXT NOT NULL DEFAULT '',
  related_tool_slugs_json TEXT NOT NULL DEFAULT '[]',
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS tools (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  pricing TEXT NOT NULL,
  website TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  base_url TEXT NOT NULL,
  feed_url TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'error')),
  enabled INTEGER NOT NULL DEFAULT 1,
  crawl_interval_minutes INTEGER NOT NULL DEFAULT 60,
  parser_key TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  last_crawled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS crawl_tasks (
  id TEXT PRIMARY KEY,
  source_id TEXT,
  title TEXT NOT NULL,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  run_mode TEXT NOT NULL,
  target_url TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  items_found INTEGER NOT NULL DEFAULT 0,
  error_message TEXT NOT NULL DEFAULT '',
  requested_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL
) STRICT;

CREATE TABLE IF NOT EXISTS review_queue (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('post', 'tool')),
  entity_id TEXT NOT NULL,
  entity_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  source_name TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  review_status TEXT NOT NULL CHECK (review_status IN ('pending', 'approved', 'changes_requested')),
  ai_summary TEXT NOT NULL DEFAULT '',
  editor_note TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 3,
  queued_at TEXT NOT NULL,
  reviewed_at TEXT,
  updated_at TEXT NOT NULL
) STRICT;

CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tools_status ON tools(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sources_status ON sources(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawl_tasks_status ON crawl_tasks(status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_queue_status ON review_queue(review_status, queued_at DESC);
