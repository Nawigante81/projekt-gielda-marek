ALTER TABLE news
  ADD COLUMN IF NOT EXISTS clean_summary TEXT,
  ADD COLUMN IF NOT EXISTS impact_label TEXT,
  ADD COLUMN IF NOT EXISTS priority_category TEXT,
  ADD COLUMN IF NOT EXISTS priority_rank INTEGER,
  ADD COLUMN IF NOT EXISTS priority_score DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS ai_summary_json TEXT;

CREATE INDEX IF NOT EXISTS idx_news_published_at ON news (published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_priority_rank ON news (priority_rank, published_at DESC);
