CREATE TABLE IF NOT EXISTS schema_migrations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  id BIGSERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  company_name TEXT,
  shares NUMERIC NOT NULL DEFAULT 0,
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  purchase_date TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchlist (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT UNIQUE NOT NULL,
  company_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS watchlists (
  id BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  auto_analyze INTEGER DEFAULT 1,
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stocks (
  ticker TEXT PRIMARY KEY,
  company_name TEXT,
  sector TEXT,
  industry TEXT,
  market_cap NUMERIC,
  exchange TEXT,
  currency TEXT DEFAULT 'USD',
  is_active INTEGER DEFAULT 1,
  metadata_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_history (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  date TEXT NOT NULL,
  open NUMERIC,
  high NUMERIC,
  low NUMERIC,
  close NUMERIC,
  volume BIGINT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ticker, date)
);

CREATE TABLE IF NOT EXISTS stock_prices (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  date TEXT NOT NULL,
  open NUMERIC,
  high NUMERIC,
  low NUMERIC,
  close NUMERIC,
  volume BIGINT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ticker, date)
);

CREATE TABLE IF NOT EXISTS current_prices (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT UNIQUE NOT NULL,
  price NUMERIC,
  change_pct NUMERIC,
  change_abs NUMERIC,
  volume BIGINT,
  market_cap NUMERIC,
  pe_ratio NUMERIC,
  high_52w NUMERIC,
  low_52w NUMERIC,
  avg_volume NUMERIC,
  source TEXT,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS technical_indicators (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sma_20 NUMERIC,
  sma_50 NUMERIC,
  sma_200 NUMERIC,
  ema_12 NUMERIC,
  ema_26 NUMERIC,
  ema_50 NUMERIC,
  rsi_14 NUMERIC,
  macd_line NUMERIC,
  macd_signal NUMERIC,
  macd_histogram NUMERIC,
  bb_upper NUMERIC,
  bb_middle NUMERIC,
  bb_lower NUMERIC,
  bb_width NUMERIC,
  stoch_k NUMERIC,
  stoch_d NUMERIC,
  adx NUMERIC,
  plus_di NUMERIC,
  minus_di NUMERIC,
  ichimoku_tenkan NUMERIC,
  ichimoku_kijun NUMERIC,
  ichimoku_senkou_a NUMERIC,
  ichimoku_senkou_b NUMERIC,
  fib_0 NUMERIC,
  fib_236 NUMERIC,
  fib_382 NUMERIC,
  fib_500 NUMERIC,
  fib_618 NUMERIC,
  fib_100 NUMERIC,
  signal_sma TEXT DEFAULT 'neutral',
  signal_ema TEXT DEFAULT 'neutral',
  signal_macd TEXT DEFAULT 'neutral',
  signal_rsi TEXT DEFAULT 'neutral',
  signal_bb TEXT DEFAULT 'neutral',
  signal_stoch TEXT DEFAULT 'neutral',
  signal_adx TEXT DEFAULT 'neutral',
  signal_ichimoku TEXT DEFAULT 'neutral',
  signal_fib TEXT DEFAULT 'neutral',
  overall_signal TEXT DEFAULT 'neutral',
  overall_score NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS market_indices (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  value NUMERIC,
  change_pct NUMERIC,
  change_abs NUMERIC,
  trend TEXT DEFAULT 'neutral',
  market_status TEXT DEFAULT 'neutral',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_reports (
  id BIGSERIAL PRIMARY KEY,
  report_type TEXT NOT NULL DEFAULT 'scheduled',
  trigger_time TEXT,
  content TEXT NOT NULL,
  summary TEXT,
  market_sentiment TEXT DEFAULT 'neutral',
  portfolio_summary TEXT,
  top_alerts TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  value NUMERIC,
  threshold NUMERIC,
  is_read INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS news (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT,
  headline TEXT NOT NULL,
  summary TEXT,
  source TEXT,
  url TEXT,
  sentiment TEXT DEFAULT 'neutral',
  published_at TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sentiment (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT,
  source_type TEXT NOT NULL DEFAULT 'news',
  score NUMERIC NOT NULL,
  label TEXT NOT NULL,
  impact_score NUMERIC DEFAULT 0,
  source_count INTEGER DEFAULT 0,
  summary TEXT,
  metadata_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fetch_errors (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT,
  source TEXT,
  error_type TEXT,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_schedule (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  cron_expression TEXT NOT NULL,
  timezone TEXT DEFAULT 'America/New_York',
  is_enabled INTEGER DEFAULT 1,
  last_run TEXT,
  next_run TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_history (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  company_name TEXT,
  price NUMERIC NOT NULL,
  score NUMERIC NOT NULL,
  recommendation TEXT NOT NULL,
  sentiment NUMERIC DEFAULT 0,
  change_pct NUMERIC,
  volume BIGINT,
  report_type TEXT DEFAULT 'manual',
  details_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recommendations (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  analysis_history_id BIGINT,
  score NUMERIC NOT NULL,
  recommendation TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  horizon_7d_price NUMERIC,
  horizon_30d_price NUMERIC,
  horizon_90d_price NUMERIC,
  horizon_180d_price NUMERIC,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sector_analysis (
  id BIGSERIAL PRIMARY KEY,
  sector TEXT NOT NULL,
  analysis_date TEXT NOT NULL,
  avg_change_pct NUMERIC DEFAULT 0,
  sentiment_score NUMERIC DEFAULT 0,
  sentiment_label TEXT DEFAULT 'neutral',
  best_ticker TEXT,
  best_change_pct NUMERIC,
  worst_ticker TEXT,
  worst_change_pct NUMERIC,
  constituents_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sector, analysis_date)
);

CREATE TABLE IF NOT EXISTS market_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  ticker TEXT,
  sector TEXT,
  event_date TEXT NOT NULL,
  period_label TEXT,
  impact TEXT DEFAULT 'medium',
  source TEXT,
  details_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_chat_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  context_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_tracking (
  id BIGSERIAL PRIMARY KEY,
  recommendation_id BIGINT,
  ticker TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  price_7d NUMERIC,
  price_30d NUMERIC,
  price_90d NUMERIC,
  price_180d NUMERIC,
  return_7d NUMERIC,
  return_30d NUMERIC,
  return_90d NUMERIC,
  return_180d NUMERIC,
  success_rate NUMERIC DEFAULT 0,
  average_return NUMERIC DEFAULT 0,
  accuracy_label TEXT DEFAULT 'pending',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id BIGSERIAL PRIMARY KEY,
  rule_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_enabled INTEGER DEFAULT 1,
  threshold_value NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_ticker ON price_history(ticker);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(date);
CREATE INDEX IF NOT EXISTS idx_stock_prices_ticker ON stock_prices(ticker);
CREATE INDEX IF NOT EXISTS idx_stock_prices_date ON stock_prices(date);
CREATE INDEX IF NOT EXISTS idx_alerts_ticker ON alerts(ticker);
CREATE INDEX IF NOT EXISTS idx_alerts_read ON alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_technical_ticker ON technical_indicators(ticker);
CREATE INDEX IF NOT EXISTS idx_news_ticker ON news(ticker);
CREATE INDEX IF NOT EXISTS idx_analysis_history_ticker ON analysis_history(ticker);
CREATE INDEX IF NOT EXISTS idx_analysis_history_created_at ON analysis_history(created_at);
CREATE INDEX IF NOT EXISTS idx_recommendations_ticker ON recommendations(ticker);
CREATE INDEX IF NOT EXISTS idx_market_events_date ON market_events(event_date);
CREATE INDEX IF NOT EXISTS idx_sentiment_ticker ON sentiment(ticker);

