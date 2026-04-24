UPDATE crawl_tasks
SET
  source_id = 'source_1',
  title = 'Fetch latest OpenAI News feed',
  task_type = 'crawl',
  run_mode = 'scheduled',
  target_url = 'https://openai.com/news/rss.xml',
  summary = 'Seeded task template for the OpenAI source.',
  error_message = '',
  updated_at = '2026-04-22T12:35:00.000Z'
WHERE id = 'task_1';

UPDATE crawl_tasks
SET
  source_id = 'source_2',
  title = 'Fetch current Hacker News top stories',
  task_type = 'crawl',
  run_mode = 'scheduled',
  target_url = 'https://hacker-news.firebaseio.com/v0/topstories.json',
  summary = 'Seeded task template for the Hacker News source.',
  error_message = '',
  updated_at = '2026-04-22T12:35:00.000Z'
WHERE id = 'task_2';

UPDATE crawl_tasks
SET
  source_id = 'source_3',
  title = 'Fetch Anthropic newsroom updates',
  task_type = 'crawl',
  run_mode = 'manual',
  target_url = 'https://www.anthropic.com/news',
  summary = 'Seeded task template for the Anthropic source.',
  error_message = 'Temporary network failure while fetching the page.',
  updated_at = '2026-04-22T12:35:00.000Z'
WHERE id = 'task_3';
