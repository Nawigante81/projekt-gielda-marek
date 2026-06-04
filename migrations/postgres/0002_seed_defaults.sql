INSERT INTO users (username, password_hash, updated_at)
VALUES (
  'pytomek@o2.pl',
  '$2b$10$EagBw8xPW9r.bRaoNqmK5OxrDuL7qEoim85wsm5bUvP5tXUHbrZqy',
  NOW()
)
ON CONFLICT (username)
DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = NOW();

INSERT INTO app_settings (key, value, updated_at)
VALUES
  ('analysis_hour_1', '10:30', NOW()),
  ('analysis_hour_2', '12:30', NOW()),
  ('analysis_hour_3', '16:05', NOW()),
  ('analysis_hour_4', '16:30', NOW()),
  ('premarket_check', '08:00', NOW()),
  ('rsi_overbought', '70', NOW()),
  ('rsi_oversold', '30', NOW()),
  ('volume_spike_threshold', '150', NOW()),
  ('price_move_threshold', '5', NOW()),
  ('data_source_primary', 'finnhub', NOW()),
  ('data_source_secondary', 'alphavantage', NOW()),
  ('data_source_fallback', 'yfinance', NOW()),
  ('timezone', 'America/New_York', NOW()),
  ('report_language', 'pl', NOW()),
  ('mode', 'test', NOW()),
  ('market_cache_ttl_seconds', '900', NOW()),
  ('event_cache_ttl_seconds', '21600', NOW()),
  ('news_cache_ttl_seconds', '3600', NOW()),
  ('retry_attempts', '3', NOW()),
  ('market_timezone', 'America/New_York', NOW()),
  ('sentiment_weight', '10', NOW()),
  ('auto_watchlist_analysis', '1', NOW()),
  ('notifications_telegram', '0', NOW()),
  ('notifications_email', '0', NOW()),
  ('notifications_webhook', '0', NOW()),
  ('webhook_url', '', NOW())
ON CONFLICT (key)
DO NOTHING;

INSERT INTO market_indices (symbol, name)
VALUES
  ('SPY', 'S&P 500'),
  ('QQQ', 'Nasdaq 100'),
  ('DIA', 'Dow Jones'),
  ('IWM', 'Russell 2000'),
  ('^VIX', 'VIX'),
  ('DX-Y.NYB', 'DXY'),
  ('^TNX', 'US 10Y Yield'),
  ('GC=F', 'Gold'),
  ('CL=F', 'Oil (WTI)'),
  ('BTC-USD', 'Bitcoin'),
  ('ETH-USD', 'Ethereum')
ON CONFLICT (symbol)
DO NOTHING;

INSERT INTO watchlists (name, slug, description, color, is_default)
VALUES
  ('AI', 'ai', 'Spolki zwiazane ze sztuczna inteligencja', '#0ea5e9', 1),
  ('TECH', 'tech', 'Szeroki sektor technologiczny', '#8b5cf6', 0),
  ('DIVIDEND', 'dividend', 'Spolki dywidendowe', '#22c55e', 0),
  ('ETF', 'etf', 'Fundusze i ETF-y', '#f59e0b', 0)
ON CONFLICT (name)
DO NOTHING;

INSERT INTO alert_rules (rule_key, name, description, threshold_value)
VALUES
  ('rsi_below_30', 'RSI < 30', 'Alert przy wejsciu w strefe wyprzedania', 30),
  ('rsi_above_70', 'RSI > 70', 'Alert przy wejsciu w strefe wykupienia', 70),
  ('golden_cross', 'Golden Cross', 'SMA50 przecina SMA200 od dolu', NULL),
  ('death_cross', 'Death Cross', 'SMA50 przecina SMA200 od gory', NULL),
  ('ema_cross', 'Przeciecie EMA', 'EMA12 przecina EMA26', NULL),
  ('break_sma200', 'Przebicie SMA200', 'Cena przebija SMA200', NULL),
  ('volume_300', 'Wolumen > 300% sredniej', 'Nagly skok wolumenu', 300),
  ('new_ath', 'Nowe ATH', 'Nowe roczne maksimum', NULL),
  ('new_atl', 'Nowe ATL', 'Nowe roczne minimum', NULL),
  ('gap_up', 'Gap Up', 'Otwarcie powyzej poprzedniego high', NULL),
  ('gap_down', 'Gap Down', 'Otwarcie ponizej poprzedniego low', NULL)
ON CONFLICT (rule_key)
DO NOTHING;
