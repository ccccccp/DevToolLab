-- Create a persistent log table for tracking crawl task details
CREATE TABLE IF NOT EXISTS crawl_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES crawl_tasks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crawl_logs_task_id ON crawl_logs(task_id, created_at ASC);
