INSERT OR IGNORE INTO tools (
  id, slug, name, summary, description, category, pricing, website, tags_json, status, featured, created_at, updated_at
) VALUES
(
  'tool_1',
  'cursor',
  'Cursor',
  'AI editor built for coding workflows and project-scale code understanding.',
  'Cursor is useful when you already have real repository context and need generation, editing and refactoring in one loop.',
  'Coding',
  'Paid',
  'https://cursor.com',
  '["Code","Editor","Developer Tools"]',
  'published',
  1,
  '2026-04-18T08:00:00.000Z',
  '2026-04-22T08:00:00.000Z'
),
(
  'tool_2',
  'notebooklm',
  'NotebookLM',
  'A research-oriented assistant for grounding summaries against source material.',
  'NotebookLM is best used for document-backed summarization, source comparison and editorial prep work.',
  'Research',
  'Freemium',
  'https://notebooklm.google.com',
  '["Summary","Research","Documents"]',
  'published',
  1,
  '2026-04-19T08:00:00.000Z',
  '2026-04-22T08:00:00.000Z'
),
(
  'tool_3',
  'perplexity',
  'Perplexity',
  'Search-centric Q&A with source citations for quick topic validation.',
  'Perplexity works well as a fast research layer when you need cited answers and broad source scanning.',
  'Search',
  'Freemium',
  'https://www.perplexity.ai',
  '["Search","Q&A","Citations"]',
  'published',
  0,
  '2026-04-17T08:00:00.000Z',
  '2026-04-20T08:00:00.000Z'
);

INSERT OR IGNORE INTO sources (
  id, name, slug, type, base_url, feed_url, status, enabled, crawl_interval_minutes, parser_key, notes, last_crawled_at, created_at, updated_at
) VALUES
(
  'source_1',
  'OpenAI News',
  'openai-news',
  'official-blog',
  'https://openai.com',
  'https://openai.com/news/rss.xml',
  'active',
  1,
  120,
  'rss-standard',
  'Official RSS feed for announcements and releases.',
  NULL,
  '2026-04-20T08:00:00.000Z',
  '2026-04-22T08:00:00.000Z'
),
(
  'source_2',
  'Hacker News',
  'hacker-news',
  'news',
  'https://news.ycombinator.com',
  'https://hacker-news.firebaseio.com/v0/topstories.json',
  'active',
  1,
  30,
  'hn-top',
  'Public API for startup and open source news.',
  NULL,
  '2026-04-20T08:00:00.000Z',
  '2026-04-22T08:00:00.000Z'
),
(
  'source_3',
  'Anthropic Newsroom',
  'anthropic-newsroom',
  'official-blog',
  'https://www.anthropic.com',
  'https://www.anthropic.com/news',
  'active',
  1,
  180,
  'anthropic-newsroom',
  'Official newsroom page for product and company updates.',
  NULL,
  '2026-04-20T08:00:00.000Z',
  '2026-04-22T08:00:00.000Z'
);

INSERT OR IGNORE INTO crawl_tasks (
  id, source_id, title, task_type, status, run_mode, target_url, summary, items_found, error_message, requested_at, started_at, finished_at, updated_at
) VALUES
(
  'task_1',
  'source_1',
  'Fetch latest OpenAI News feed',
  'crawl',
  'completed',
  'scheduled',
  'https://openai.com/news/rss.xml',
  'Initial seeded task record for the OpenAI source.',
  5,
  '',
  '2026-04-22T07:00:00.000Z',
  '2026-04-22T07:01:00.000Z',
  '2026-04-22T07:02:00.000Z',
  '2026-04-22T07:02:00.000Z'
),
(
  'task_2',
  'source_2',
  'Fetch current Hacker News top stories',
  'crawl',
  'running',
  'scheduled',
  'https://hacker-news.firebaseio.com/v0/topstories.json',
  'Seeded running task example.',
  0,
  '',
  '2026-04-22T08:00:00.000Z',
  '2026-04-22T08:00:20.000Z',
  NULL,
  '2026-04-22T08:00:20.000Z'
),
(
  'task_3',
  'source_3',
  'Fetch Anthropic newsroom updates',
  'crawl',
  'failed',
  'manual',
  'https://www.anthropic.com/news',
  'Seeded failed task example for debugging.',
  0,
  'Temporary network failure while fetching the page.',
  '2026-04-21T10:00:00.000Z',
  '2026-04-21T10:00:10.000Z',
  '2026-04-21T10:00:15.000Z',
  '2026-04-21T10:00:15.000Z'
);

INSERT OR IGNORE INTO review_queue (
  id, entity_type, entity_id, entity_slug, title, source_name, source_url, review_status, ai_summary, editor_note, priority, queued_at, reviewed_at, updated_at
) VALUES
(
  'review_2',
  'tool',
  'tool_3',
  'perplexity',
  'Perplexity',
  'Perplexity',
  'https://www.perplexity.ai',
  'changes_requested',
  'Description is usable, but pricing tiers and target audience still need to be clarified.',
  'Add clearer positioning before promoting it.',
  2,
  '2026-04-21T09:00:00.000Z',
  '2026-04-21T12:00:00.000Z',
  '2026-04-21T12:00:00.000Z'
);
