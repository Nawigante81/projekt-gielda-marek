"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "react-hot-toast";
import type {
  Alert,
  EarningsEvent,
  ExplanationState,
  HeatmapTile,
  InsightItem,
  MarketEvent,
  MarketIndex,
  MarketSentimentSnapshot,
  NewsItem,
  PerformancePayload,
  PortfolioItem,
  RankedItem,
  Report,
  SecFiling,
  SectorRow,
  WatchlistItem,
} from "@/components/views/dashboard-types";
import {
  buildReportSections,
  clamp,
  formatDaysUntil,
  getDownsideReason,
  getPotentialLabel,
  getPotentialReason,
  recommendationFromScore,
  scoreBand,
  toActionLabel,
  toMarketStatusLabel,
  toMomentumLabel,
  toRiskLabel,
  toSetupType,
} from "@/components/views/dashboard-utils";
import { MARKET_UNIVERSE_BY_TICKER } from "@/lib/market-universe";

const KEY_INDICES = ["SPY", "QQQ", "DIA", "IWM", "^VIX", "GC=F", "CL=F", "BTC-USD"];
const SECTOR_ORDER = ["Technology", "Finance", "Energy", "Healthcare", "Consumer", "Industrial", "Utilities", "Real Estate", "Artificial Intelligence"];

function buildExplanationFromPortfolio(
  item: PortfolioItem,
  earnings: EarningsEvent | undefined,
  secFilings: SecFiling[],
  alerts: Alert[],
  sectorLeader: string | null
): ExplanationState {
  const score = item.ai_score ?? 0;
  const reasons: string[] = [];
  const technicalReasons: string[] = [];
  const fundamentalReasons: string[] = [];
  const risks: string[] = [];
  const context: string[] = [];

  if ((item.volume ?? 0) > ((item.avg_volume ?? Infinity) * 1.5)) {
    technicalReasons.push(`wzrost wolumenu +${(((item.volume || 0) / Math.max(item.avg_volume || 1, 1)) * 100 - 100).toFixed(0)}%`);
  }
  if (item.signal_sma === "bullish" || item.signal_ema === "bullish") technicalReasons.push("trend powyżej kluczowych średnich");
  if (item.signal_macd === "bullish") technicalReasons.push("pozytywny sygnał MACD");
  else if (item.signal_macd === "bearish") risks.push("MACD ostrzega przed korektą");
  if ((item.rsi_14 ?? 50) >= 45 && (item.rsi_14 ?? 50) <= 65) technicalReasons.push(`RSI w zdrowym zakresie (${(item.rsi_14 ?? 0).toFixed(1)})`);
  else if ((item.rsi_14 ?? 50) < 35) technicalReasons.push(`RSI w strefie wyprzedania (${(item.rsi_14 ?? 0).toFixed(1)})`);
  else if ((item.rsi_14 ?? 50) > 70) risks.push(`RSI blisko wykupienia (${(item.rsi_14 ?? 0).toFixed(1)})`);
  if ((item.news_sentiment_score ?? 0) >= 20) fundamentalReasons.push("pozytywne newsy i sentyment");
  if ((item.news_sentiment_score ?? 0) <= -20) risks.push("negatywny sentyment newsowy");
  if (earnings) context.push(`wyniki za ${formatDaysUntil(earnings.event_date)}`);
  if (secFilings.length > 0) fundamentalReasons.push(`brak negatywnego filing SEC: ${secFilings[0].form}`);
  if (alerts.some((alert) => alert.ticker === item.ticker && alert.severity === "warning")) context.push("aktywny alert ryzyka");
  if (sectorLeader) context.push(`sektor lidera: ${sectorLeader}`);

  if ((item.change_pct ?? 0) < 0) {
    risks.push("słabnący momentum dzienny");
  }

  reasons.push(...technicalReasons, ...fundamentalReasons);
  const current = item.current_price || item.purchase_price;
  const stopLoss = current ? (current * 0.97).toFixed(2) : null;
  const takeProfit = current ? (current * (score >= 70 ? 1.08 : 1.04)).toFixed(2) : null;

  return {
    ticker: item.ticker,
    companyName: item.company_name || item.ticker,
    aiScore: score,
    recommendation: scoreBand(score),
    actionLabel: toActionLabel(score),
    probability: clamp(Math.round(score * 0.82), 18, 92),
    riskLabel: toRiskLabel(score, item.adx),
    reasons: reasons.slice(0, 5),
    risks: Array.from(new Set(risks)).slice(0, 3),
    technicalReasons: technicalReasons.slice(0, 3),
    fundamentalReasons: fundamentalReasons.slice(0, 3),
    changeTriggers: [
      takeProfit ? `BUY po wybiciu powyżej ${takeProfit} przy rosnącym wolumenie.` : "",
      stopLoss ? `REDUCE po zejściu poniżej ${stopLoss}.` : "",
    ].filter(Boolean),
    marketContext: context.slice(0, 4),
  };
}

function buildExplanationFromRankedItem(
  item: RankedItem,
  earnings: EarningsEvent | undefined,
  secFilings: SecFiling[],
  alerts: Alert[],
  sectorLeader: string | null,
  mode: "best" | "worst"
): ExplanationState {
  const reasons: string[] = [];
  const technicalReasons: string[] = [];
  const fundamentalReasons: string[] = [];
  const risks: string[] = [];
  const context: string[] = [];

  if (mode === "best") {
    if (item.ai_score >= 85) technicalReasons.push("bardzo wysoki AI Score i przewaga techniczna");
    if ((item.change_pct ?? 0) > 2) technicalReasons.push(`silne momentum (${item.change_pct.toFixed(2)}%)`);
    if ((item.rsi_14 ?? 50) < 40) technicalReasons.push(`RSI daje jeszcze miejsce na ruch (${(item.rsi_14 ?? 0).toFixed(1)})`);
    fundamentalReasons.push(getPotentialReason(item));
  } else {
    if (item.ai_score < 35) risks.push("niski AI Score i słaba jakość układu");
    if ((item.change_pct ?? 0) < -2) risks.push(`ujemne momentum (${item.change_pct.toFixed(2)}%)`);
    if ((item.rsi_14 ?? 50) > 70) risks.push(`wykupienie podnosi ryzyko korekty (${(item.rsi_14 ?? 0).toFixed(1)})`);
    fundamentalReasons.push(getDownsideReason(item));
  }

  if (earnings) context.push(`wyniki za ${formatDaysUntil(earnings.event_date)}`);
  if (secFilings.length > 0) context.push(`świeży SEC: ${secFilings[0].form} (${formatDaysUntil(secFilings[0].filing_date)})`);
  if (alerts.some((alert) => alert.ticker === item.ticker && alert.severity === "warning")) context.push("aktywny alert ryzyka");
  if (sectorLeader) context.push(`sektor lidera: ${sectorLeader}`);
  reasons.push(...technicalReasons, ...fundamentalReasons);

  return {
    ticker: item.ticker,
    companyName: item.company_name,
    aiScore: item.ai_score,
    recommendation: item.recommendation,
    actionLabel: mode === "best" ? "BUY" : "REDUCE",
    probability: clamp(Math.round(item.ai_score * 0.88), 15, 95),
    riskLabel: item.ai_score >= 75 ? "Niskie" : item.ai_score >= 45 ? "Średnie" : "Wysokie",
    reasons: reasons.slice(0, 5),
    risks: risks.slice(0, 3),
    technicalReasons: technicalReasons.slice(0, 3),
    fundamentalReasons: fundamentalReasons.slice(0, 3),
    changeTriggers: mode === "best"
      ? ["BUY po utrzymaniu siły i dalszym wzroście wolumenu.", "REDUCE przy utracie momentum poniżej lokalnego wsparcia."]
      : ["BUY dopiero po odbudowie momentum i poprawie AI Score.", "REDUCE / SELL przy dalszym osłabieniu ceny."],
    marketContext: context.slice(0, 4),
  };
}

export function useDashboardData() {
  const { setActiveView, setSelectedTicker, setAnalysisRunning, analysisRunning } = useAppStore();
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [rankings, setRankings] = useState<{ topBuy: RankedItem[]; topSell: RankedItem[]; topMomentum: RankedItem[]; topOversold: RankedItem[]; topOverbought: RankedItem[]; }>({ topBuy: [], topSell: [], topMomentum: [], topOversold: [], topOverbought: [] });
  const [performance, setPerformance] = useState<PerformancePayload | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapTile[]>([]);
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [earnings, setEarnings] = useState<EarningsEvent[]>([]);
  const [secFilings, setSecFilings] = useState<SecFiling[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [marketSentimentData, setMarketSentimentData] = useState<MarketSentimentSnapshot | null>(null);
  const [vixHistory, setVixHistory] = useState<Array<{ date: string; close: number }>>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [analysisHistory, setAnalysisHistory] = useState<Array<{ ticker: string; company_name?: string | null; score: number; recommendation: string; change_pct?: number | null; created_at: string }>>([]);
  const [watchlistActivity, setWatchlistActivity] = useState({ total: 0, autoAnalyze: 0, withAlerts: 0 });
  const [loading, setLoading] = useState(true);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<ExplanationState | null>(null);
  const [mobileAccordion, setMobileAccordion] = useState({ summary: true, portfolio: false, market: false, opportunities: false, calendar: false, alerts: false });

  const fetchAll = useCallback(async () => {
    try {
      const [mktRes, portRes, alertRes, repRes, statusRes, rankingsRes, performanceRes, heatmapRes, calendarRes, watchRes, earningsRes, secRes, newsRes, sectorsRes, sentimentRes, vixRes, analysisHistoryRes] = await Promise.all([
        fetch("/api/market"), fetch("/api/portfolio"), fetch("/api/alerts?unread=true&limit=12"), fetch("/api/reports"), fetch("/api/analysis/run"), fetch("/api/rankings?limit=8"), fetch("/api/performance"), fetch("/api/heatmap?index=SP500"), fetch("/api/market-events"), fetch("/api/watchlist"), fetch("/api/earnings-calendar"), fetch("/api/sec-filings"), fetch("/api/news"), fetch("/api/sectors"), fetch("/api/market-sentiment"), fetch("/api/ticker/%5EVIX"), fetch("/api/analysis-history?limit=24"),
      ]);
      if (mktRes.ok) setIndices(await mktRes.json());
      if (portRes.ok) setPortfolio(await portRes.json());
      if (alertRes.ok) { const unreadAlerts = await alertRes.json(); setAlerts(unreadAlerts); useAppStore.getState().setUnreadAlerts(unreadAlerts.length); }
      if (repRes.ok) { const reports = await repRes.json(); if (reports.length > 0) setReport(reports[0]); }
      if (statusRes.ok) { const status = await statusRes.json(); setAnalysisRunning(status.running); setLastRun(status.lastRun); }
      if (rankingsRes.ok) { const data = await rankingsRes.json(); setRankings({ topBuy: data.topBuy || [], topSell: data.topSell || [], topMomentum: data.topMomentum || [], topOversold: data.topOversold || [], topOverbought: data.topOverbought || [] }); }
      if (performanceRes.ok) setPerformance(await performanceRes.json());
      if (heatmapRes.ok) { const data = await heatmapRes.json(); setHeatmap(data.tiles || []); }
      if (calendarRes.ok) { const data = await calendarRes.json(); setEvents(data.events || []); }
      if (watchRes.ok) {
        const watchlist = (await watchRes.json()) as WatchlistItem[];
        setWatchlist(watchlist);
        setWatchlistActivity({ total: watchlist.length, autoAnalyze: watchlist.filter((item) => item.auto_analyze === 1).length, withAlerts: watchlist.filter((item) => Boolean(item.latest_alert)).length });
      }
      if (earningsRes.ok) { const data = await earningsRes.json(); setEarnings(data.events || []); }
      if (secRes.ok) setSecFilings(await secRes.json());
      if (newsRes.ok) {
        const data = await newsRes.json();
        setNews(Array.isArray(data) ? data : data.items || []);
      }
      if (sectorsRes.ok) setSectors(await sectorsRes.json());
      if (sentimentRes.ok) setMarketSentimentData(await sentimentRes.json());
      if (vixRes.ok) { const data = await vixRes.json(); setVixHistory((data.history || []).map((bar: { date: string; close: number }) => ({ date: bar.date, close: bar.close }))); }
      if (analysisHistoryRes.ok) setAnalysisHistory(await analysisHistoryRes.json());
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [setAnalysisRunning]);

  useEffect(() => { void fetchAll(); const interval = setInterval(() => { void fetchAll(); }, 60000); return () => clearInterval(interval); }, [fetchAll]);

  const runAnalysis = async () => {
    if (analysisRunning) return;
    setAnalysisRunning(true);
    toast.loading("Uruchamianie analizy...", { id: "analysis" });
    try {
      const res = await fetch("/api/analysis/run", { method: "POST" });
      const data = await res.json();
      if (res.ok) { toast.success("Analiza uruchomiona w tle", { id: "analysis" }); setTimeout(() => void fetchAll(), 5000); } else { toast.error(data.error || "Błąd analizy", { id: "analysis" }); setAnalysisRunning(false); }
    } catch {
      toast.error("Błąd połączenia", { id: "analysis" });
      setAnalysisRunning(false);
    }
  };

  const totalPortfolioValue = portfolio.reduce((sum, item) => { const price = item.current_price || item.purchase_price; return item.status === "sold" ? sum : sum + price * item.shares; }, 0);
  const totalPnL = portfolio.reduce((sum, item) => { const price = item.current_price || item.purchase_price; return item.status === "sold" ? sum : sum + (price - item.purchase_price) * item.shares; }, 0);
  const totalCost = portfolio.reduce((sum, item) => (item.status === "sold" ? sum : sum + item.purchase_price * item.shares), 0);
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const vix = indices.find((item) => item.symbol === "^VIX");
  const spy = indices.find((item) => item.symbol === "SPY");
  const qqq = indices.find((item) => item.symbol === "QQQ");
  const marketSentiment = vix && spy ? (vix.value && vix.value > 25 ? "risk-off" : spy.change_pct && spy.change_pct > 0.5 ? "risk-on" : "neutral") : "neutral";

  const groupedHeatmap = useMemo(() => { const grouped = new Map<string, HeatmapTile[]>(); for (const sector of SECTOR_ORDER) grouped.set(sector, []); heatmap.forEach((tile) => { const key = grouped.has(tile.sector) ? tile.sector : "Other"; const current = grouped.get(key) || []; current.push(tile); grouped.set(key, current); }); return [...grouped.entries()].map(([sector, rows]) => ({ sector, rows: rows.sort((left, right) => right.market_cap - left.market_cap).slice(0, 6) })).filter((entry) => entry.rows.length > 0); }, [heatmap]);
  const strongestSector = sectors.length > 0 ? [...sectors].sort((a, b) => b.avg_change_pct - a.avg_change_pct)[0] : null;
  const weakestSectorRaw = sectors.length > 1 ? [...sectors].sort((a, b) => a.avg_change_pct - b.avg_change_pct)[0] : null;
  const weakestSector = weakestSectorRaw && strongestSector && weakestSectorRaw.sector !== strongestSector.sector ? weakestSectorRaw : null;
  const earningsByTicker = useMemo(() => { const map = new Map<string, EarningsEvent>(); earnings.forEach((event) => { if (event.ticker && !map.has(event.ticker)) map.set(event.ticker, event); }); return map; }, [earnings]);
  const filingsByTicker = useMemo(() => { const map = new Map<string, SecFiling[]>(); secFilings.forEach((filing) => { const current = map.get(filing.ticker) || []; current.push(filing); map.set(filing.ticker, current); }); return map; }, [secFilings]);
  const aiInsights = useMemo(() => {
    const insights: InsightItem[] = [];
    portfolio.forEach((item) => {
      if ((item.volume ?? 0) > ((item.avg_volume ?? Number.POSITIVE_INFINITY) * 1.8)) insights.push({ id: `volume-${item.ticker}`, ticker: item.ticker, icon: "fire", title: `${item.ticker} +${(item.change_pct ?? 0).toFixed(2)}% przy wzroście wolumenu`, description: `Wolumen ${Math.round(((item.volume || 0) / Math.max(item.avg_volume || 1, 1)) * 100)}% średniej`, accent: "text-emerald-400", sourceView: "ticker", sourceTicker: item.ticker });
      if (item.signal_sma === "bullish" || item.signal_ema === "bullish") insights.push({ id: `breakout-${item.ticker}`, ticker: item.ticker, icon: "fire", title: `${item.ticker} wybicie techniczne`, description: "Cena utrzymuje przewagę nad średnimi kroczącymi", accent: "text-blue-300", sourceView: "ticker", sourceTicker: item.ticker });
      const nextEarnings = earningsByTicker.get(item.ticker);
      if (nextEarnings) insights.push({ id: `earnings-${item.ticker}`, ticker: item.ticker, icon: "warn", title: `${item.ticker} publikuje wyniki za ${formatDaysUntil(nextEarnings.event_date)}`, description: nextEarnings.title, accent: "text-amber-300", sourceView: "earnings", sourceTicker: item.ticker });
    });
    alerts.forEach((alert) => { if (alert.alert_type.includes("sec_")) insights.push({ id: `alert-${alert.id}`, ticker: alert.ticker, icon: "warn", title: alert.message, description: "świeży filing SEC wymaga interpretacji", accent: "text-fuchsia-300", sourceView: "sec", sourceTicker: alert.ticker }); if (alert.alert_type.includes("earnings_upcoming")) insights.push({ id: `earn-alert-${alert.id}`, ticker: alert.ticker, icon: "warn", title: alert.message, description: "wyniki finansowe mogą podnieść zmienność", accent: "text-amber-300", sourceView: "earnings", sourceTicker: alert.ticker }); });
    if (strongestSector) insights.push({ id: "sector-strong", ticker: strongestSector.best_ticker, icon: "idea", title: `Sektor dnia: ${strongestSector.sector}`, description: `${strongestSector.avg_change_pct >= 0 ? "+" : ""}${strongestSector.avg_change_pct.toFixed(2)}% średnio`, accent: "text-emerald-300", sourceView: "market", sourceTicker: strongestSector.best_ticker });
    if (vix?.change_pct && vix.change_pct > 2) insights.push({ id: "vix-up", ticker: "^VIX", icon: "warn", title: `VIX rośnie: ${vix.change_pct >= 0 ? "+" : ""}${vix.change_pct.toFixed(2)}%`, description: "rynek wycenia wyższą zmienność krótkoterminową", accent: "text-red-300", sourceView: "market", sourceTicker: null });
    if (events.some((event) => ["CPI", "PPI", "NFP", "FOMC", "FED", "GDP", "Unemployment"].includes(event.event_type))) { const macro = events.find((event) => ["CPI", "PPI", "NFP", "FOMC", "FED", "GDP", "Unemployment"].includes(event.event_type)); if (macro) insights.push({ id: `macro-${macro.id}`, ticker: macro.ticker, icon: "warn", title: `${macro.event_type} w kalendarzu makro`, description: `${macro.title} • ${new Date(macro.event_date).toLocaleString("pl-PL")}`, accent: "text-amber-300", sourceView: "market", sourceTicker: null }); }
    return insights.slice(0, 8);
  }, [alerts, earningsByTicker, events, portfolio, strongestSector, vix]);

  const rankedUniverse = useMemo(() => {
    const byTicker = new Map<string, RankedItem>();

    const addCandidate = (candidate: RankedItem) => {
      if (!candidate?.ticker) return;
      const existing = byTicker.get(candidate.ticker);
      if (!existing || (candidate.ai_score ?? 0) > (existing.ai_score ?? 0)) {
        byTicker.set(candidate.ticker, candidate);
      }
    };

    rankings.topBuy.forEach((item) => addCandidate({ ...item, source_kind: "ranking" }));
    rankings.topSell.forEach((item) => addCandidate({ ...item, source_kind: "ranking" }));
    rankings.topMomentum.forEach((item) => addCandidate({ ...item, source_kind: "ranking" }));
    rankings.topOversold.forEach((item) => addCandidate({ ...item, source_kind: "ranking" }));
    rankings.topOverbought.forEach((item) => addCandidate({ ...item, source_kind: "ranking" }));

    portfolio.forEach((item) => addCandidate({
      ticker: item.ticker,
      company_name: item.company_name || item.ticker,
      price: item.current_price || item.purchase_price,
      change_pct: item.change_pct ?? 0,
      market_cap: null,
      ai_score: item.ai_score ?? 0,
      recommendation: item.recommendation || recommendationFromScore(item.ai_score),
      rsi_14: item.rsi_14 ?? null,
      overall_signal: item.overall_signal ?? null,
      sector: MARKET_UNIVERSE_BY_TICKER[item.ticker]?.sector || "Unknown",
      source_kind: "portfolio",
    }));

    watchlist.forEach((item) => addCandidate({
      ticker: item.ticker,
      company_name: item.company_name || item.ticker,
      price: item.current_price ?? 0,
      change_pct: item.change_pct ?? 0,
      market_cap: null,
      ai_score: item.ai_score ?? 0,
      recommendation: item.recommendation || recommendationFromScore(item.ai_score),
      rsi_14: item.rsi_14 ?? null,
      overall_signal: item.overall_signal ?? null,
      sector: item.sector || MARKET_UNIVERSE_BY_TICKER[item.ticker]?.sector || "Unknown",
      source_kind: "watchlist",
    }));

    analysisHistory.forEach((item) => addCandidate({
      ticker: item.ticker,
      company_name: item.company_name || item.ticker,
      price: 0,
      change_pct: item.change_pct ?? 0,
      market_cap: null,
      ai_score: item.score ?? 0,
      recommendation: item.recommendation || recommendationFromScore(item.score),
      rsi_14: null,
      overall_signal: null,
      sector: MARKET_UNIVERSE_BY_TICKER[item.ticker]?.sector || "Unknown",
      source_kind: "history",
    }));

    ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL"].forEach((ticker) => {
      if (byTicker.has(ticker)) return;
      const meta = MARKET_UNIVERSE_BY_TICKER[ticker];
      if (!meta) return;
      addCandidate({
        ticker,
        company_name: meta.company_name,
        price: 0,
        change_pct: 0,
        market_cap: meta.market_cap,
        ai_score: 0,
        recommendation: "Watch",
        rsi_14: null,
        overall_signal: null,
        sector: meta.sector,
        source_kind: "seed",
      });
    });

    return [...byTicker.values()];
  }, [analysisHistory, portfolio, rankings, watchlist]);

  const bestOpportunities = useMemo(() => {
    const base = rankedUniverse
      .filter((item) => (item.ai_score ?? 0) >= 40)
      .sort((left, right) => (right.ai_score - left.ai_score) || ((right.change_pct ?? 0) - (left.change_pct ?? 0)));

    return base.slice(0, 5).map((item) => ({
      ...item,
      setup_type: toSetupType(item.ai_score, item.change_pct),
      potential: getPotentialLabel(item),
      momentum_label: toMomentumLabel(item.change_pct),
      risk: item.ai_score >= 85 ? "Niskie" : item.ai_score >= 70 ? "Średnie" : "Wysokie",
      reason: item.reason || getPotentialReason(item),
    }));
  }, [rankedUniverse]);

  const worstOpportunities = useMemo(() => {
    const excludedTickers = new Set(bestOpportunities.map((item) => item.ticker));
    const base = rankedUniverse
      .filter((item) => item.source_kind !== "seed" && !excludedTickers.has(item.ticker))
      .sort((left, right) => (left.ai_score - right.ai_score) || ((left.change_pct ?? 0) - (right.change_pct ?? 0)));

    return base.slice(0, 5).map((item) => ({
      ...item,
      setup_type: toSetupType(item.ai_score, item.change_pct),
      potential: getPotentialLabel({ ...item, ai_score: 100 - item.ai_score }),
      momentum_label: toMomentumLabel(item.change_pct),
      risk: item.ai_score <= 25 ? "Wysokie" : "Średnie",
      reason: item.reason || getDownsideReason(item),
    }));
  }, [bestOpportunities, rankedUniverse]);

  const marketNow = useMemo(() => {
    const meaningfulTiles = heatmap.filter((tile) => tile.price !== null);
    const positiveTiles = meaningfulTiles.filter((tile) => tile.change_pct > 0).length;
    const negativeTiles = meaningfulTiles.filter((tile) => tile.change_pct < 0).length;
    const breadthSample = positiveTiles + negativeTiles;
    const breadth = breadthSample >= 3 ? positiveTiles / breadthSample : null;
    const capitalFlow = strongestSector && weakestSector ? strongestSector.avg_change_pct - weakestSector.avg_change_pct : null;
    return {
      fearGreed: marketSentimentData?.fearGreedScore ?? null,
      fearGreedLabel: marketSentimentData?.fearGreedLabel ?? null,
      vix: vix?.value ?? null,
      putCallRatio: marketSentimentData?.putCallRatio ?? null,
      putCallType: marketSentimentData?.putCallType ?? null,
      advanceDecline: breadth,
      strongestSector,
      weakestSector,
      sectorOfTheDay: strongestSector?.sector || "Brak danych",
      capitalFlow,
      breadthLabel: breadth === null ? "Brak danych" : breadth > 0.58 ? "risk-on" : breadth < 0.42 ? "risk-off" : "neutral",
    };
  }, [heatmap, marketSentimentData, strongestSector, weakestSector, vix]);
  const sentimentTrend = useMemo(() => { const history = (marketSentimentData?.history || []).slice().reverse(); const fearGreed = history.map((entry) => entry.fear_greed_score).filter((value): value is number => value !== null); const putCall = history.map((entry) => entry.put_call_ratio).filter((value): value is number => value !== null); const breadth = history.map((entry) => entry.breadth_score).filter((value): value is number => value !== null); return { fearGreed, putCall, breadth, latestFearGreedDelta: fearGreed.length >= 2 ? fearGreed[fearGreed.length - 1] - fearGreed[0] : null, latestPutCallDelta: putCall.length >= 2 ? putCall[putCall.length - 1] - putCall[0] : null, latestBreadthDelta: breadth.length >= 2 ? breadth[breadth.length - 1] - breadth[0] : null }; }, [marketSentimentData]);
  const vixTrend = useMemo(() => { const closes = vixHistory.map((bar) => bar.close).filter((value): value is number => value !== null && value !== undefined); return { closes: closes.slice(-7), latestDelta: closes.length >= 2 ? closes[closes.length - 1] - closes[closes.length - 2] : null }; }, [vixHistory]);

  const marketDecision = useMemo(() => {
    const status = toMarketStatusLabel({
      spyChangePct: spy?.change_pct,
      vixValue: vix?.value,
      fearGreed: marketNow.fearGreed,
      breadth: marketNow.advanceDecline,
    });

    let score = 50;
    const reasons: string[] = [];
    const technicalNotes: string[] = [];

    if ((spy?.change_pct ?? null) !== null) {
      score += clamp((spy?.change_pct ?? 0) * 10, -12, 12);
      if ((spy?.change_pct ?? 0) > 0) reasons.push("S&P 500 utrzymuje dodatnią zmianę dzienną");
      else reasons.push("S&P 500 nie potwierdza siły rynku");
    }

    if ((vix?.value ?? null) !== null) {
      if ((vix?.value ?? 0) < 18) {
        score += 10;
        reasons.push("VIX pozostaje pod kontrolą");
      } else if ((vix?.value ?? 0) > 24) {
        score -= 16;
        reasons.push("VIX wskazuje podwyższone ryzyko zmienności");
      } else {
        reasons.push("VIX jest stabilny, ale bez wyraźnego impulsu risk-on");
      }
    } else {
      technicalNotes.push("Dane VIX niedostępne — pominięto w ocenie rynku.");
    }

    if (marketNow.advanceDecline !== null) {
      if (marketNow.advanceDecline >= 0.58) {
        score += 12;
        reasons.push("Szerokość rynku wspiera stronę popytową");
      } else if (marketNow.advanceDecline <= 0.42) {
        score -= 12;
        reasons.push("Brak potwierdzenia breadth osłabia sygnał rynku");
      } else {
        reasons.push("Breadth pozostaje mieszany");
      }
    } else {
      technicalNotes.push("Dane breadth niedostępne — pominięto w ocenie rynku.");
    }

    if (marketNow.fearGreed !== null) {
      if (marketNow.fearGreed >= 60) {
        score += 8;
        reasons.push("Fear & Greed wspiera apetyt na ryzyko");
      } else if (marketNow.fearGreed <= 35) {
        score -= 8;
        reasons.push("Fear & Greed ostrzega przed defensywnym nastawieniem");
      }
    } else {
      technicalNotes.push("Fear & Greed niedostępny — pominięto w ocenie rynku.");
    }

    const portfolioBullish = portfolio.filter((item) => (item.ai_score ?? 0) >= 70).length;
    const portfolioWeak = portfolio.filter((item) => (item.ai_score ?? 0) < 45).length;
    if (portfolioBullish > portfolioWeak && portfolioBullish > 0) {
      score += 6;
      reasons.push("Portfel ma przewagę pozytywnych układów technicznych");
    } else if (portfolioWeak > portfolioBullish && portfolioWeak > 0) {
      score -= 6;
      reasons.push("Portfel pokazuje więcej słabych układów niż mocnych");
    }

    const normalizedScore = clamp(Math.round(score), 0, 100);
    const action =
      status === "BULLISH" ? "Można selektywnie zwiększać ekspozycję." :
      status === "RISK-OFF" ? "Nie zwiększaj ekspozycji, skup się na ochronie kapitału." :
      status === "BEARISH" ? "Ogranicz nowe wejścia i monitoruj poziomy obrony." :
      "Nie zwiększaj ekspozycji bez potwierdzenia rynku.";

    return {
      status,
      score: normalizedScore,
      action,
      reasons: reasons.slice(0, 5),
      technicalNotes,
    };
  }, [marketNow, portfolio, spy?.change_pct, vix?.value]);

  const reportSections = useMemo(() => buildReportSections(report?.content || ""), [report?.content]);
  const reportDecisionSummary = useMemo(() => {
    const decision = marketDecision.status === "BULLISH" ? "HOLD / SELECTIVE BUY" : marketDecision.status === "RISK-OFF" ? "RISK-OFF" : marketDecision.status === "BEARISH" ? "REDUCE" : "HOLD";
    const certainty = clamp(Math.round((marketDecision.score * 0.72) + ((portfolio.length > 0 ? 8 : 0))), 25, 92);
    const biggestRisk = marketDecision.reasons.find((reason) => reason.toLowerCase().includes("ryzy")) || marketDecision.reasons.find((reason) => reason.toLowerCase().includes("brak")) || "Brak pełnego potwierdzenia rynku.";
    const biggestChance = marketDecision.reasons.find((reason) => reason.toLowerCase().includes("wspiera")) || marketDecision.reasons.find((reason) => reason.toLowerCase().includes("przewagę")) || "Utrzymanie trendu nad średnimi w najmocniejszych spółkach.";
    return { decision, certainty, biggestRisk, biggestChance };
  }, [marketDecision, portfolio.length]);

  useEffect(() => { if (explanation || portfolio.length === 0) return; const first = portfolio[0]; setExplanation(buildExplanationFromPortfolio(first, earningsByTicker.get(first.ticker), filingsByTicker.get(first.ticker) || [], alerts, strongestSector?.sector || null)); }, [alerts, earningsByTicker, explanation, filingsByTicker, portfolio, strongestSector]);

  const openTicker = (ticker: string | null | undefined) => { if (!ticker) return; setSelectedTicker(ticker); setActiveView("ticker"); };
  const openInsight = (item: InsightItem) => { if (item.sourceTicker) openTicker(item.sourceTicker); else setActiveView(item.sourceView); };
  const inspectRankedItem = (item: RankedItem, mode: "best" | "worst") => { setExplanation(buildExplanationFromRankedItem(item, earningsByTicker.get(item.ticker), filingsByTicker.get(item.ticker) || [], alerts, strongestSector?.sector || null, mode)); };
  const toggleAccordion = (section: keyof typeof mobileAccordion) => { setMobileAccordion((current) => ({ ...current, [section]: !current[section] })); };

  return {
    activeView: setActiveView,
    analysisRunning,
    alerts,
    aiInsights,
    bestOpportunities,
    fetchAll,
    events,
    filingsByTicker,
    groupedHeatmap,
    heatmap,
    earnings,
    earningsByTicker,
    explanation,
    inspectRankedItem,
    indices,
    keyIndices: indices.filter((item) => KEY_INDICES.includes(item.symbol)),
    lastRun,
    loading,
    marketNow,
    marketSentiment,
    marketSentimentData,
    mobileAccordion,
    news,
    openInsight,
    openTicker,
    performance,
    portfolio,
    rankings,
    report,
    runAnalysis,
    sectors,
    secFilings,
    setActiveView,
    setExplanation,
    setSelectedTicker,
    setAnalysisRunning,
    sentimentTrend,
    strongestSector,
    weakestSector,
    totalCost,
    totalPortfolioValue,
    totalPnL,
    totalPnLPct,
    toggleAccordion,
    qqq,
    spy,
    vix,
    vixHistory,
    vixTrend,
    watchlistActivity,
    watchlist,
    analysisHistory,
    marketDecision,
    reportDecisionSummary,
    reportSections,
    worstOpportunities,
  };
}
