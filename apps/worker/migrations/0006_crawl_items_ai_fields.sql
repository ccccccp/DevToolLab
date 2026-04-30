-- Migration to add AI-related fields to crawl_items table
ALTER TABLE crawl_items ADD COLUMN raw_content TEXT NOT NULL DEFAULT '';
ALTER TABLE crawl_items ADD COLUMN extraction_status TEXT NOT NULL DEFAULT 'not_started';
ALTER TABLE crawl_items ADD COLUMN ai_output_json TEXT NOT NULL DEFAULT '{}';
