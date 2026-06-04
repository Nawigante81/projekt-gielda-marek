export interface MarketIndex {
  symbol: string;
  name: string;
  value: number | null;
  change_pct: number | null;
  trend: string;
  market_status: string;
  last_updated: string;
}

export interface MarketSentimentSnapshot {
  fearGreedScore: number | null;
  fearGreedLabel: string | null;
  fearGreedUpdatedAt: string | null;
  putCallRatio: number | null;
  putCallType: string | null;
  vixValue: number | null;
  vixChangePct: number | null;
  breadthScore: number | null;
  breadthLabel: string | null;
  source: {
    fearGreed: string;
    putCall: string;
  };
  history?: Array<{
    captured_at: string;
    fear_greed_score: number | null;
    put_call_ratio: number | null;
    fear_greed_label: string | null;
    vix_value: number | null;
    breadth_score: number | null;
  }>;
}

export interface PortfolioItem {
  id: number;
  ticker: string;
  company_name: string;
  shares: number;
  purchase_price: number;
  purchase_date: string;
  currency: "USD" | "EUR" | "PLN" | "GBP";
  alert_threshold: number | null;
  status: "observed" | "owned" | "sold";
  current_price: number | null;
  change_pct: number | null;
  volume: number | null;
  avg_volume: number | null;
  overall_signal: string | null;
  overall_score: number | null;
  ai_score: number | null;
  recommendation: string | null;
  rsi_14: number | null;
  adx: number | null;
  sma_20: number | null;
  sma_50: number | null;
  sma_200: number | null;
  signal_macd: string | null;
  signal_sma: string | null;
  signal_ema: string | null;
  news_sentiment_score: number | null;
  news_sentiment_label: string | null;
}

export interface Alert {
  id: number;
  ticker: string;
  alert_type: string;
  severity: string;
  message: string;
  created_at: string;
  is_read: number;
}

export interface Report {
  id: number;
  content: string;
  market_sentiment: string;
  created_at: string;
  report_type: string;
}

export interface RankedItem {
  ticker: string;
  company_name: string;
  price: number;
  change_pct: number;
  market_cap: number | null;
  ai_score: number;
  recommendation: string;
  rsi_14: number | null;
  overall_signal: string | null;
  sector: string;
  source_kind?: "portfolio" | "watchlist" | "ranking" | "history" | "seed";
  setup_type?: "LONG" | "SHORT" | "WATCH";
  momentum_label?: string;
  reason?: string;
  risk?: string;
  potential?: string;
}

export interface PerformanceSummary {
  total: number;
  successRate: number;
  averageReturn: number;
  accurateCount: number;
  missCount: number;
}

export interface PerformanceItem {
  ticker: string;
  average_return: number | null;
  recommendation: string | null;
  score: number | null;
}

export interface PerformancePayload {
  summary: PerformanceSummary | null;
  topHits: PerformanceItem[];
  topMisses: PerformanceItem[];
}

export interface HeatmapTile {
  ticker: string;
  company_name: string;
  sector: string;
  market_cap: number;
  price: number | null;
  change_pct: number;
  ai_score: number;
  recommendation: string;
}

export interface MarketEvent {
  id: number;
  title: string;
  ticker: string | null;
  event_type: string;
  event_date: string;
  impact?: string | null;
  source?: string | null;
}

export interface EarningsEvent {
  id: number;
  title: string;
  ticker: string | null;
  event_date: string;
  impact: string | null;
  source: string | null;
}

export interface SecFiling {
  id: number;
  ticker: string;
  form: string;
  filing_date: string;
  filing_url: string | null;
}

export interface NewsItem {
  id: number;
  ticker: string;
  headline: string;
  sentiment_label: "positive" | "neutral" | "negative" | null;
  sentiment_score: number | null;
  impact_score: number | null;
}

export interface SectorRow {
  sector: string;
  avg_change_pct: number;
  sentiment_score: number;
  sentiment_label: string;
  best_ticker: string | null;
  best_change_pct: number | null;
  worst_ticker: string | null;
  worst_change_pct: number | null;
}

export interface WatchlistItem {
  id: number;
  ticker: string;
  company_name?: string;
  current_price?: number | null;
  change_pct?: number | null;
  ai_score?: number | null;
  recommendation?: string | null;
  rsi_14?: number | null;
  adx?: number | null;
  overall_signal?: string | null;
  news_sentiment_score?: number | null;
  sector?: string | null;
  auto_analyze?: number;
  latest_alert?: string | null;
}

export interface InsightItem {
  id: string;
  ticker: string | null;
  icon: "fire" | "warn" | "idea";
  title: string;
  description: string;
  accent: string;
  sourceView: string;
  sourceTicker?: string | null;
}

export interface ExplanationState {
  ticker: string;
  companyName: string;
  aiScore: number;
  recommendation: string;
  actionLabel?: string;
  probability: number;
  riskLabel: string;
  reasons: string[];
  risks?: string[];
  technicalReasons?: string[];
  fundamentalReasons?: string[];
  changeTriggers?: string[];
  marketContext: string[];
}
