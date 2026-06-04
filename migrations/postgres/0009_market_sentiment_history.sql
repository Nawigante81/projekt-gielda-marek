CREATE TABLE IF NOT EXISTS market_sentiment_history (
    id BIGSERIAL PRIMARY KEY,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fear_greed_score DOUBLE PRECISION,
    fear_greed_label TEXT,
    put_call_ratio DOUBLE PRECISION,
    vix_value DOUBLE PRECISION,
    breadth_score DOUBLE PRECISION
);

CREATE INDEX IF NOT EXISTS idx_market_sentiment_history_captured_at
ON market_sentiment_history(captured_at DESC);
