"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  Activity,
  AlertCircle,
  Bell,
  Brain,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  FileSearch,
  FileText,
  Flame,
  Gauge,
  Loader2,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import SignalBadge from "@/components/SignalBadge";
import DashboardOpportunities from "@/components/DashboardOpportunities";
import DashboardHeatmap from "@/components/DashboardHeatmap";
import DashboardExplanation from "@/components/DashboardExplanation";
import DashboardEventsCalendar from "@/components/DashboardEventsCalendar";
import DashboardSnapshot from "@/components/DashboardSnapshot";
import DashboardPerformance from "@/components/DashboardPerformance";
import RecommendationBadge, { recommendationTone } from "@/components/RecommendationBadge";
import PriceChange from "@/components/PriceChange";
import TrendLabel from "@/components/TrendLabel";
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
  clamp,
  compactNumber,
  formatCurrency,
  formatDaysUntil,
  getDownsideReason,
  getEventImpactTone,
  getPotentialLabel,
  getPotentialReason,
  getStopLoss,
  getTakeProfit,
  recommendationFromScore,
  riskTone,
  scoreBand,
  toRiskLabel,
} from "@/components/views/dashboard-utils";
import toast from "react-hot-toast";

const INDEX_ICONS: Record<string, string> = {
  SPY: "SPX",
  QQQ: "NDQ",
  DIA: "DOW",
  IWM: "RUT",
  "^VIX": "VIX",
  "GC=F": "GOLD",
  "CL=F": "OIL",
  "BTC-USD": "BTC",
  "ETH-USD": "ETH",
};

const KEY_INDICES = ["SPY", "QQQ", "DIA", "IWM", "^VIX", "GC=F", "CL=F", "BTC-USD"];

const SECTOR_ORDER = [
  "Technology",
  "Finance",
  "Energy",
  "Healthcare",
  "Consumer",
  "Industrial",
  "Utilities",
  "Real Estate",
  "Artificial Intelligence",
];

function buildExplanationFromPortfolio(
  item: PortfolioItem,
  earnings: EarningsEvent | undefined,
  secFilings: SecFiling[],
  alerts: Alert[],
  sectorLeader: string | null
): ExplanationState {
  const score = item.ai_score ?? 0;
  const reasons: string[] = [];
  const context: string[] = [];

  if ((item.volume ?? 0) > ((item.avg_volume ?? Infinity) * 1.5)) {
    reasons.push(`wzrost wolumenu +${(((item.volume || 0) / Math.max(item.avg_volume || 1, 1)) * 100 - 100).toFixed(0)}%`);
  }
  if (item.signal_sma === "bullish" || item.signal_ema === "bullish") {
    reasons.push("trend powyżej kluczowych średnich");
  }
  if (item.signal_macd === "bullish") {
    reasons.push("pozytywny sygnał MACD");
  }
  if ((item.rsi_14 ?? 50) >= 45 && (item.rsi_14 ?? 50) <= 65) {
    reasons.push(`RSI w zdrowym zakresie (${(item.rsi_14 ?? 0).toFixed(1)})`);
  } else if ((item.rsi_14 ?? 50) < 35) {
    reasons.push(`RSI w strefie wyprzedania (${(item.rsi_14 ?? 0).toFixed(1)})`);
  }
  if ((item.news_sentiment_score ?? 0) >= 20) {
    reasons.push("pozytywne newsy i sentyment");
  }
  if (earnings) {
    context.push(`wyniki za ${formatDaysUntil(earnings.event_date)}`);
  }
  if (secFilings.length > 0) {
    context.push(`świeży SEC: ${secFilings[0].form} (${formatDaysUntil(secFilings[0].filing_date)})`);
  }
  if (alerts.some((alert) => alert.ticker === item.ticker && alert.severity === "warning")) {
    context.push("aktywny alert ryzyka");
  }
  if (sectorLeader) {
    context.push(`sektor lidera: ${sectorLeader}`);
  }

  return {
    ticker: item.ticker,
    companyName: item.company_name || item.ticker,
    aiScore: score,
    recommendation: scoreBand(score),
    probability: clamp(Math.round(score * 0.82), 18, 92),
    riskLabel: toRiskLabel(score, item.adx),
    reasons: reasons.slice(0, 5),
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
  const context: string[] = [];

  if (mode === "best") {
    if (item.ai_score >= 85) reasons.push("bardzo wysoki AI Score i przewaga techniczna");
    if ((item.change_pct ?? 0) > 2) reasons.push(`silne momentum (${item.change_pct.toFixed(2)}%)`);
    if ((item.rsi_14 ?? 50) < 40) reasons.push(`RSI daje jeszcze miejsce na ruch (${(item.rsi_14 ?? 0).toFixed(1)})`);
    reasons.push(getPotentialReason(item));
  } else {
    if (item.ai_score < 35) reasons.push("niski AI Score i słaba jakość układu");
    if ((item.change_pct ?? 0) < -2) reasons.push(`ujemne momentum (${item.change_pct.toFixed(2)}%)`);
    if ((item.rsi_14 ?? 50) > 70) reasons.push(`wykupienie podnosi ryzyko korekty (${(item.rsi_14 ?? 0).toFixed(1)})`);
    reasons.push(getDownsideReason(item));
  }

  if (earnings) {
    context.push(`wyniki za ${formatDaysUntil(earnings.event_date)}`);
  }
  if (secFilings.length > 0) {
    context.push(`świeży SEC: ${secFilings[0].form} (${formatDaysUntil(secFilings[0].filing_date)})`);
  }
  if (alerts.some((alert) => alert.ticker === item.ticker && alert.severity === "warning")) {
    context.push("aktywny alert ryzyka");
  }
  if (sectorLeader) {
    context.push(`lider siły sektorowej: ${sectorLeader}`);
  }

  const scoreLabel = scoreBand(item.ai_score);

  return {
    ticker: item.ticker,
    companyName: item.company_name || item.ticker,
    aiScore: item.ai_score ?? 0,
    recommendation: scoreLabel,
    probability: mode === "best"
      ? clamp(Math.round((item.ai_score ?? 0) * 0.8), 22, 93)
      : clamp(Math.round((100 - (item.ai_score ?? 0)) * 0.72), 15, 84),
    riskLabel: mode === "best"
      ? ((item.ai_score ?? 0) >= 80 ? "Niskie" : (item.ai_score ?? 0) >= 65 ? "Średnie" : "Wysokie")
      : ((item.ai_score ?? 0) <= 25 ? "Wysokie" : "Średnie"),
    reasons: Array.from(new Set(reasons)).slice(0, 5),
    marketContext: context.slice(0, 4),
  };
}

export default function Dashboard() {
  const { setActiveView, setSelectedTicker, analysisRunning, setAnalysisRunning } = useAppStore();
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [rankings, setRankings] = useState<{
    topBuy: RankedItem[];
    topSell: RankedItem[];
    topMomentum: RankedItem[];
    topOversold: RankedItem[];
    topOverbought: RankedItem[];
  }>({ topBuy: [], topSell: [], topMomentum: [], topOversold: [], topOverbought: [] });
  const [performance, setPerformance] = useState<PerformancePayload | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapTile[]>([]);
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [earnings, setEarnings] = useState<EarningsEvent[]>([]);
  const [secFilings, setSecFilings] = useState<SecFiling[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [marketSentimentData, setMarketSentimentData] = useState<MarketSentimentSnapshot | null>(null);
  const [vixHistory, setVixHistory] = useState<Array<{ date: string; close: number }>>([]);
  const [watchlistActivity, setWatchlistActivity] = useState({ total: 0, autoAnalyze: 0, withAlerts: 0 });
  const [loading, setLoading] = useState(true);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<ExplanationState | null>(null);
  const [mobileAccordion, setMobileAccordion] = useState({
    summary: true,
    portfolio: false,
    market: false,
    opportunities: false,
    calendar: false,
    alerts: false,
  });

  const fetchAll = useCallback(async () => {
    try {
      const [
        mktRes,
        portRes,
        alertRes,
        repRes,
        statusRes,
        rankingsRes,
        performanceRes,
        heatmapRes,
        calendarRes,
        watchRes,
        earningsRes,
        secRes,
        newsRes,
        sectorsRes,
        sentimentRes,
        vixRes,
      ] = await Promise.all([
        fetch("/api/market"),
        fetch("/api/portfolio"),
        fetch("/api/alerts?unread=true&limit=12"),
        fetch("/api/reports"),
        fetch("/api/analysis/run"),
        fetch("/api/rankings?limit=8"),
        fetch("/api/performance"),
        fetch("/api/heatmap?index=SP500"),
        fetch("/api/market-events"),
        fetch("/api/watchlist"),
        fetch("/api/earnings-calendar"),
        fetch("/api/sec-filings"),
        fetch("/api/news"),
        fetch("/api/sectors"),
        fetch("/api/market-sentiment"),
        fetch("/api/ticker/%5EVIX"),
      ]);

      if (mktRes.ok) setIndices(await mktRes.json());
      if (portRes.ok) setPortfolio(await portRes.json());
      if (alertRes.ok) {
        const unreadAlerts = await alertRes.json();
        setAlerts(unreadAlerts);
        useAppStore.getState().setUnreadAlerts(unreadAlerts.length);
      }
      if (repRes.ok) {
        const reports = await repRes.json();
        if (reports.length > 0) setReport(reports[0]);
      }
      if (statusRes.ok) {
        const status = await statusRes.json();
        setAnalysisRunning(status.running);
        setLastRun(status.lastRun);
      }
      if (rankingsRes.ok) {
        const data = await rankingsRes.json();
        setRankings({
          topBuy: data.topBuy || [],
          topSell: data.topSell || [],
          topMomentum: data.topMomentum || [],
          topOversold: data.topOversold || [],
          topOverbought: data.topOverbought || [],
        });
      }
      if (performanceRes.ok) setPerformance(await performanceRes.json());
      if (heatmapRes.ok) {
        const data = await heatmapRes.json();
        setHeatmap(data.tiles || []);
      }
      if (calendarRes.ok) {
        const data = await calendarRes.json();
        setEvents(data.events || []);
      }
      if (watchRes.ok) {
        const watchlist = (await watchRes.json()) as WatchlistItem[];
        setWatchlistActivity({
          total: watchlist.length,
          autoAnalyze: watchlist.filter((item) => item.auto_analyze === 1).length,
          withAlerts: watchlist.filter((item) => Boolean(item.latest_alert)).length,
        });
      }
      if (earningsRes.ok) {
        const data = await earningsRes.json();
        setEarnings(data.events || []);
      }
      if (secRes.ok) setSecFilings(await secRes.json());
      if (newsRes.ok) setNews(await newsRes.json());
      if (sectorsRes.ok) setSectors(await sectorsRes.json());
      if (sentimentRes.ok) setMarketSentimentData(await sentimentRes.json());
      if (vixRes.ok) {
        const data = await vixRes.json();
        setVixHistory((data.history || []).map((bar: { date: string; close: number }) => ({ date: bar.date, close: bar.close })));
      }
    } catch (error) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, [setAnalysisRunning]);

  useEffect(() => {
    void fetchAll();
    const interval = setInterval(() => {
      void fetchAll();
    }, 60000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const runAnalysis = async () => {
    if (analysisRunning) return;
    setAnalysisRunning(true);
    toast.loading("Uruchamianie analizy...", { id: "analysis" });
    try {
      const res = await fetch("/api/analysis/run", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success("Analiza uruchomiona w tle", { id: "analysis" });
        setTimeout(() => void fetchAll(), 5000);
      } else {
        toast.error(data.error || "Błąd analizy", { id: "analysis" });
        setAnalysisRunning(false);
      }
    } catch {
      toast.error("Błąd połączenia", { id: "analysis" });
      setAnalysisRunning(false);
    }
  };

  const totalPortfolioValue = portfolio.reduce((sum, item) => {
    const price = item.current_price || item.purchase_price;
    return item.status === "sold" ? sum : sum + price * item.shares;
  }, 0);

  const totalPnL = portfolio.reduce((sum, item) => {
    const price = item.current_price || item.purchase_price;
    return item.status === "sold" ? sum : sum + (price - item.purchase_price) * item.shares;
  }, 0);

  const totalCost = portfolio.reduce((sum, item) => (
    item.status === "sold" ? sum : sum + item.purchase_price * item.shares
  ), 0);
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const keyIndices = indices.filter((item) => KEY_INDICES.includes(item.symbol));
  const vix = indices.find((item) => item.symbol === "^VIX");
  const spy = indices.find((item) => item.symbol === "SPY");
  const qqq = indices.find((item) => item.symbol === "QQQ");
  const marketSentiment = vix && spy
    ? (vix.value && vix.value > 25 ? "risk-off" : spy.change_pct && spy.change_pct > 0.5 ? "risk-on" : "neutral")
    : "neutral";

  const groupedHeatmap = useMemo(() => {
    const grouped = new Map<string, HeatmapTile[]>();
    for (const sector of SECTOR_ORDER) {
      grouped.set(sector, []);
    }

    heatmap.forEach((tile) => {
      const key = grouped.has(tile.sector) ? tile.sector : "Other";
      const current = grouped.get(key) || [];
      current.push(tile);
      grouped.set(key, current);
    });

    return [...grouped.entries()]
      .map(([sector, rows]) => ({
        sector,
        rows: rows.sort((left, right) => right.market_cap - left.market_cap).slice(0, 6),
      }))
      .filter((entry) => entry.rows.length > 0);
  }, [heatmap]);

  const strongestSector = sectors.length > 0 ? [...sectors].sort((a, b) => b.avg_change_pct - a.avg_change_pct)[0] : null;
  const weakestSector = sectors.length > 0 ? [...sectors].sort((a, b) => a.avg_change_pct - b.avg_change_pct)[0] : null;

  const earningsByTicker = useMemo(() => {
    const map = new Map<string, EarningsEvent>();
    earnings.forEach((event) => {
      if (event.ticker && !map.has(event.ticker)) {
        map.set(event.ticker, event);
      }
    });
    return map;
  }, [earnings]);

  const filingsByTicker = useMemo(() => {
    const map = new Map<string, SecFiling[]>();
    secFilings.forEach((filing) => {
      const current = map.get(filing.ticker) || [];
      current.push(filing);
      map.set(filing.ticker, current);
    });
    return map;
  }, [secFilings]);

  const aiInsights = useMemo(() => {
    const insights: InsightItem[] = [];

    portfolio.forEach((item) => {
      if ((item.volume ?? 0) > ((item.avg_volume ?? Number.POSITIVE_INFINITY) * 1.8)) {
        insights.push({
          id: `volume-${item.ticker}`,
          ticker: item.ticker,
          icon: "fire",
          title: `${item.ticker} +${(item.change_pct ?? 0).toFixed(2)}% przy wzroście wolumenu`,
          description: `Wolumen ${Math.round(((item.volume || 0) / Math.max(item.avg_volume || 1, 1)) * 100)}% średniej`,
          accent: "text-emerald-400",
          sourceView: "ticker",
          sourceTicker: item.ticker,
        });
      }
      if (item.signal_sma === "bullish" || item.signal_ema === "bullish") {
        insights.push({
          id: `breakout-${item.ticker}`,
          ticker: item.ticker,
          icon: "fire",
          title: `${item.ticker} wybicie techniczne`,
          description: "Cena utrzymuje przewagę nad średnimi kroczącymi",
          accent: "text-blue-300",
          sourceView: "ticker",
          sourceTicker: item.ticker,
        });
      }
      const nextEarnings = earningsByTicker.get(item.ticker);
      if (nextEarnings) {
        insights.push({
          id: `earnings-${item.ticker}`,
          ticker: item.ticker,
          icon: "warn",
          title: `${item.ticker} publikuje wyniki za ${formatDaysUntil(nextEarnings.event_date)}`,
          description: nextEarnings.title,
          accent: "text-amber-300",
          sourceView: "earnings",
          sourceTicker: item.ticker,
        });
      }
    });

    alerts.forEach((alert) => {
      if (alert.alert_type.includes("sec_")) {
        insights.push({
          id: `alert-${alert.id}`,
          ticker: alert.ticker,
          icon: "warn",
          title: alert.message,
          description: "świeży filing SEC wymaga interpretacji",
          accent: "text-fuchsia-300",
          sourceView: "sec",
          sourceTicker: alert.ticker,
        });
      }
      if (alert.alert_type.includes("earnings_upcoming")) {
        insights.push({
          id: `earn-alert-${alert.id}`,
          ticker: alert.ticker,
          icon: "warn",
          title: alert.message,
          description: "wyniki finansowe mogą podnieść zmienność",
          accent: "text-amber-300",
          sourceView: "earnings",
          sourceTicker: alert.ticker,
        });
      }
    });

    if (strongestSector) {
      insights.push({
        id: "sector-strong",
        ticker: strongestSector.best_ticker,
        icon: "idea",
        title: `Sektor dnia: ${strongestSector.sector}`,
        description: `${strongestSector.avg_change_pct >= 0 ? "+" : ""}${strongestSector.avg_change_pct.toFixed(2)}% średnio`,
        accent: "text-emerald-300",
        sourceView: "market",
        sourceTicker: strongestSector.best_ticker,
      });
    }
    if (vix?.change_pct && vix.change_pct > 2) {
      insights.push({
        id: "vix-up",
        ticker: "^VIX",
        icon: "warn",
        title: `VIX rośnie: ${vix.change_pct >= 0 ? "+" : ""}${vix.change_pct.toFixed(2)}%`,
        description: "rynek wycenia wyższą zmienność krótkoterminową",
        accent: "text-red-300",
        sourceView: "market",
        sourceTicker: null,
      });
    }
    if (events.some((event) => ["CPI", "PPI", "NFP", "FOMC", "FED", "GDP", "Unemployment"].includes(event.event_type))) {
      const macro = events.find((event) => ["CPI", "PPI", "NFP", "FOMC", "FED", "GDP", "Unemployment"].includes(event.event_type));
      if (macro) {
        insights.push({
          id: `macro-${macro.id}`,
          ticker: macro.ticker,
          icon: "warn",
          title: `${macro.event_type} w kalendarzu makro`,
          description: `${macro.title} • ${new Date(macro.event_date).toLocaleString("pl-PL")}`,
          accent: "text-amber-300",
          sourceView: "market",
          sourceTicker: null,
        });
      }
    }

    return insights.slice(0, 8);
  }, [alerts, earningsByTicker, events, portfolio, strongestSector, vix]);

  const bestOpportunities = useMemo(() => (
    rankings.topBuy.slice(0, 5).map((item) => ({
      ...item,
      potential: getPotentialLabel(item),
      risk: item.ai_score >= 85 ? "Niskie" : item.ai_score >= 70 ? "Średnie" : "Wysokie",
      reason: getPotentialReason(item),
    }))
  ), [rankings.topBuy]);

  const worstOpportunities = useMemo(() => (
    rankings.topSell.slice(0, 5).map((item) => ({
      ...item,
      potential: getPotentialLabel({ ...item, ai_score: 100 - item.ai_score }),
      risk: item.ai_score <= 25 ? "Wysokie" : "Średnie",
      reason: getDownsideReason(item),
    }))
  ), [rankings.topSell]);

  const marketNow = useMemo(() => {
    const positiveTiles = heatmap.filter((tile) => tile.change_pct > 0).length;
    const negativeTiles = heatmap.filter((tile) => tile.change_pct < 0).length;
    const breadth = positiveTiles + negativeTiles > 0 ? positiveTiles / (positiveTiles + negativeTiles) : null;
    const capitalFlow = strongestSector && weakestSector
      ? strongestSector.avg_change_pct - weakestSector.avg_change_pct
      : null;

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

  const sentimentTrend = useMemo(() => {
    const history = (marketSentimentData?.history || []).slice().reverse();
    const fearGreed = history.map((entry) => entry.fear_greed_score).filter((value): value is number => value !== null);
    const putCall = history.map((entry) => entry.put_call_ratio).filter((value): value is number => value !== null);
    const breadth = history.map((entry) => entry.breadth_score).filter((value): value is number => value !== null);
    return {
      fearGreed,
      putCall,
      breadth,
      latestFearGreedDelta: fearGreed.length >= 2 ? fearGreed[fearGreed.length - 1] - fearGreed[0] : null,
      latestPutCallDelta: putCall.length >= 2 ? putCall[putCall.length - 1] - putCall[0] : null,
      latestBreadthDelta: breadth.length >= 2 ? breadth[breadth.length - 1] - breadth[0] : null,
    };
  }, [marketSentimentData]);

  const vixTrend = useMemo(() => {
    const closes = vixHistory.map((bar) => bar.close).filter((value): value is number => value !== null && value !== undefined);
    return {
      closes: closes.slice(-7),
      latestDelta: closes.length >= 2 ? closes[closes.length - 1] - closes[closes.length - 2] : null,
    };
  }, [vixHistory]);

  useEffect(() => {
    if (explanation || portfolio.length === 0) return;
    const first = portfolio[0];
    setExplanation(
      buildExplanationFromPortfolio(
        first,
        earningsByTicker.get(first.ticker),
        filingsByTicker.get(first.ticker) || [],
        alerts,
        strongestSector?.sector || null
      )
    );
  }, [alerts, earningsByTicker, explanation, filingsByTicker, portfolio, strongestSector]);

  const openTicker = (ticker: string | null | undefined) => {
    if (!ticker) return;
    setSelectedTicker(ticker);
    setActiveView("ticker");
  };

  const openInsight = (item: InsightItem) => {
    if (item.sourceTicker) openTicker(item.sourceTicker);
    else setActiveView(item.sourceView);
  };

  const inspectRankedItem = (item: RankedItem, mode: "best" | "worst") => {
    setExplanation(
      buildExplanationFromRankedItem(
        item,
        earningsByTicker.get(item.ticker),
        filingsByTicker.get(item.ticker) || [],
        alerts,
        strongestSector?.sector || null,
        mode
      )
    );
  };

  const toggleAccordion = (section: keyof typeof mobileAccordion) => {
    setMobileAccordion((current) => ({ ...current, [section]: !current[section] }));
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4 fade-in">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-600">AI Market Desk</div>
          <h1 className="mt-1 text-2xl font-semibold text-white">Dashboard decyzyjny</h1>
          <p className="mt-1 text-sm text-slate-500">
            {lastRun ? `Ostatnia analiza: ${new Date(lastRun).toLocaleString("pl-PL")}` : "Brak analizy"} • portfolio, rynek, SEC i earnings w jednym miejscu
          </p>
        </div>
        <div className="flex items-center gap-2 xl:justify-end">
          <button
            onClick={() => void fetchAll()}
            className="rounded-md border border-slate-800 p-2 text-slate-400 transition-colors hover:border-slate-700 hover:text-white"
            title="Odśwież"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={runAnalysis}
            disabled={analysisRunning}
            className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              analysisRunning
                ? "cursor-not-allowed bg-slate-700 text-slate-400"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {analysisRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {analysisRunning ? "Analizuję..." : "Uruchom analizę"}
          </button>
        </div>
      </div>

      <div className={`card p-4 ${
        marketSentiment === "risk-on"
          ? "border-emerald-800/50 bg-emerald-900/10"
          : marketSentiment === "risk-off"
            ? "border-red-800/50 bg-red-900/10"
            : "border-slate-700/50 bg-slate-900/40"
      }`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Sentyment rynku</div>
              <div className={`mt-1 text-2xl font-semibold ${
                marketSentiment === "risk-on" ? "text-emerald-400" :
                marketSentiment === "risk-off" ? "text-red-400" : "text-slate-300"
              }`}>
                {marketSentiment.toUpperCase()}
              </div>
            </div>
            <div className="h-10 w-px bg-slate-800" />
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm lg:grid-cols-4">
              <div className="text-slate-500">S&P 500: <span className="text-slate-300">{spy?.value ? formatCurrency(spy.value) : "—"}</span></div>
              <div className="text-slate-500">Nasdaq: <span className="text-slate-300">{qqq?.value ? formatCurrency(qqq.value) : "—"}</span></div>
              <div className="text-slate-500">VIX: <span className="text-slate-300">{vix?.value?.toFixed(2) || "—"}</span></div>
              <div className="text-slate-500">
                Fear & Greed:{" "}
                <span className="text-slate-300">
                  {marketNow.fearGreed === null ? "Brak danych" : `${marketNow.fearGreed.toFixed(1)}/100`}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
              <div className="text-slate-500">Breadth</div>
              <div className="mt-1 text-white">
                {marketNow.advanceDecline === null ? "Brak danych" : `${(marketNow.advanceDecline * 100).toFixed(0)}% green`}
              </div>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
              <div className="text-slate-500">Sektor dnia</div>
              <div className="mt-1 text-white">{marketNow.sectorOfTheDay}</div>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/40 px-3 py-2">
              <div className="text-slate-500">Przepływ kapitału</div>
              <div className={`mt-1 ${marketNow.capitalFlow !== null && marketNow.capitalFlow >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {marketNow.capitalFlow === null ? "Brak danych" : `${marketNow.capitalFlow >= 0 ? "+" : ""}${marketNow.capitalFlow.toFixed(2)} pkt`}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <Brain size={15} className="text-blue-400" /> Co AI zauważyło dzisiaj
            </div>
            <div className="mt-1 text-xs text-slate-500">Sygnały, które wymagają decyzji lub szybkiej obserwacji.</div>
          </div>
          <button onClick={() => setActiveView("alerts")} className="text-xs text-blue-400 hover:text-blue-300">
            Wszystkie alerty →
          </button>
        </div>
        <div className="grid gap-2 lg:grid-cols-2">
          {aiInsights.length > 0 ? aiInsights.map((item) => (
            <button
              key={item.id}
              onClick={() => openInsight(item)}
              className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-left transition-colors hover:border-blue-500/40 hover:bg-slate-900"
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 ${
                  item.icon === "fire" ? "text-emerald-400" :
                  item.icon === "warn" ? "text-amber-400" : "text-blue-300"
                }`}>
                  {item.icon === "fire" ? <Flame size={16} /> : item.icon === "warn" ? <ShieldAlert size={16} /> : <Sparkles size={16} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm font-medium ${item.accent}`}>{item.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.description}</div>
                </div>
              </div>
            </button>
          )) : (
            <div className="text-sm text-slate-600">Brak nowych obserwacji AI. Uruchom analizę, aby wygenerować sygnały.</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="card p-4">
          <div className="text-xs text-slate-500">Wartość portfolio</div>
          <div className="mt-1 text-2xl font-semibold text-white">{formatCurrency(totalPortfolioValue)}</div>
          <div className="mt-2 text-xs text-slate-500">{portfolio.filter((item) => item.status !== "sold").length} aktywnych pozycji</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">Łączny P&L</div>
          <div className={`mt-1 text-2xl font-semibold ${totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalPnL >= 0 ? "+" : ""}{formatCurrency(Math.abs(totalPnL))}
          </div>
          <div className={`mt-2 text-xs ${totalPnLPct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(2)}%
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">Alerty inwestycyjne</div>
          <div className="mt-1 text-2xl font-semibold text-amber-400">{alerts.length}</div>
          <div className="mt-2 text-xs text-slate-500">nieodczytanych</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500">Auto-watchlist</div>
          <div className="mt-1 text-2xl font-semibold text-blue-300">{watchlistActivity.autoAnalyze}</div>
          <div className="mt-2 text-xs text-slate-500">{watchlistActivity.withAlerts} tickerów z aktywnym alertem</div>
        </div>
      </div>

      <div className="space-y-3 xl:hidden">
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setActiveView("portfolio")}
            className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-left"
          >
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Szybki dostęp</div>
            <div className="mt-1 text-sm font-medium text-white">Portfolio</div>
            <div className="mt-1 text-xs text-slate-500">Pozycje i ryzyko</div>
          </button>
          <button
            onClick={() => setActiveView("alerts")}
            className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-left"
          >
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Szybki dostęp</div>
            <div className="mt-1 text-sm font-medium text-white">Alerty</div>
            <div className="mt-1 text-xs text-slate-500">{alerts.length} aktywnych</div>
          </button>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50">
          <button
            type="button"
            onClick={() => toggleAccordion("summary")}
            className="flex w-full items-center justify-between px-3 py-3 text-left"
          >
            <span className="text-sm font-medium text-slate-200">Podsumowanie rynku</span>
            {mobileAccordion.summary ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </button>
          {mobileAccordion.summary && (
            <div className="grid grid-cols-2 gap-2 border-t border-slate-800 p-3">
              <div className="rounded-md bg-slate-950/60 p-3">
                <div className="text-[11px] text-slate-500">Sentyment</div>
                <div className="mt-1 text-sm font-medium text-white">{marketSentiment.toUpperCase()}</div>
              </div>
              <div className="rounded-md bg-slate-950/60 p-3">
                <div className="text-[11px] text-slate-500">Fear & Greed</div>
                <div className="mt-1 text-sm font-medium text-white">
                  {marketNow.fearGreed === null ? "Brak danych" : marketNow.fearGreed.toFixed(1)}
                </div>
                <div className="mt-1 text-[11px] text-slate-600">{marketNow.fearGreedLabel || "brak etykiety"}</div>
              </div>
              <div className="rounded-md bg-slate-950/60 p-3">
                <div className="text-[11px] text-slate-500">VIX</div>
                <div className="mt-1 text-sm font-medium text-white">{marketNow.vix?.toFixed(2) || "Brak"}</div>
              </div>
              <div className="rounded-md bg-slate-950/60 p-3">
                <div className="text-[11px] text-slate-500">Sektor dnia</div>
                <div className="mt-1 text-sm font-medium text-white">{marketNow.sectorOfTheDay}</div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50">
          <button
            type="button"
            onClick={() => toggleAccordion("portfolio")}
            className="flex w-full items-center justify-between px-3 py-3 text-left"
          >
            <span className="text-sm font-medium text-slate-200">Portfolio</span>
            {mobileAccordion.portfolio ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </button>
          {mobileAccordion.portfolio && (
            <div className="border-t border-slate-800 p-3">
              <div className="space-y-2">
                {portfolio.slice(0, 4).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      openTicker(item.ticker);
                      setExplanation(
                        buildExplanationFromPortfolio(
                          item,
                          earningsByTicker.get(item.ticker),
                          filingsByTicker.get(item.ticker) || [],
                          alerts,
                          strongestSector?.sector || null
                        )
                      );
                    }}
                    className="w-full rounded-md border border-slate-800 bg-slate-950/60 p-3 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-white">{item.ticker}</div>
                        <div className="text-[11px] text-slate-500">{item.company_name}</div>
                      </div>
                      <div className={`text-sm font-semibold ${recommendationTone(scoreBand(item.ai_score))}`}>
                        {(item.ai_score ?? 0).toFixed(0)}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className={`font-medium ${recommendationTone(scoreBand(item.ai_score))}`}>{scoreBand(item.ai_score)}</span>
                      <span className={`${riskTone(toRiskLabel(item.ai_score, item.adx))}`}>{toRiskLabel(item.ai_score, item.adx)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50">
          <button
            type="button"
            onClick={() => toggleAccordion("market")}
            className="flex w-full items-center justify-between px-3 py-3 text-left"
          >
            <span className="text-sm font-medium text-slate-200">Rynek teraz</span>
            {mobileAccordion.market ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </button>
          {mobileAccordion.market && (
            <div className="border-t border-slate-800 p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-slate-950/60 p-3">
                  <div className="text-[11px] text-slate-500">Breadth</div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {marketNow.advanceDecline === null ? "Brak danych" : `${(marketNow.advanceDecline * 100).toFixed(0)}% green`}
                  </div>
                </div>
                <div className="rounded-md bg-slate-950/60 p-3">
                  <div className="text-[11px] text-slate-500">Kapitał</div>
                  <div className="mt-1 text-sm font-medium text-white">
                    {marketNow.capitalFlow === null ? "Brak danych" : `${marketNow.capitalFlow >= 0 ? "+" : ""}${marketNow.capitalFlow.toFixed(2)} pkt`}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50">
          <button
            type="button"
            onClick={() => toggleAccordion("opportunities")}
            className="flex w-full items-center justify-between px-3 py-3 text-left"
          >
            <span className="text-sm font-medium text-slate-200">Okazje</span>
            {mobileAccordion.opportunities ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </button>
          {mobileAccordion.opportunities && (
            <div className="border-t border-slate-800 p-3 space-y-3">
              <button onClick={() => setActiveView("scanner")} className="w-full rounded-md border border-slate-800 bg-slate-950/60 p-3 text-left text-sm text-slate-200">
                Otwórz skaner okazji
              </button>
              <button onClick={() => setActiveView("reports")} className="w-full rounded-md border border-slate-800 bg-slate-950/60 p-3 text-left text-sm text-slate-200">
                Otwórz raporty AI
              </button>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50">
          <button
            type="button"
            onClick={() => toggleAccordion("calendar")}
            className="flex w-full items-center justify-between px-3 py-3 text-left"
          >
            <span className="text-sm font-medium text-slate-200">Kalendarz i filingi</span>
            {mobileAccordion.calendar ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </button>
          {mobileAccordion.calendar && (
            <div className="border-t border-slate-800 p-3 text-sm text-slate-400">
              {events.length + earnings.length > 0 ? `${events.length + earnings.length} wydarzeń do monitorowania` : "Brak wydarzeń do wyświetlenia"}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900/50">
          <button
            type="button"
            onClick={() => toggleAccordion("alerts")}
            className="flex w-full items-center justify-between px-3 py-3 text-left"
          >
            <span className="text-sm font-medium text-slate-200">Alerty</span>
            {mobileAccordion.alerts ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
          </button>
          {mobileAccordion.alerts && (
            <div className="border-t border-slate-800 p-3 space-y-2">
              {alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="rounded-md bg-slate-950/60 p-3 text-xs text-slate-300">
                  {alert.message}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr,1fr]">
        <div className="space-y-4">
          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <Gauge size={15} className="text-blue-400" /> Rynek teraz
              </div>
              <button onClick={() => setActiveView("market")} className="text-xs text-blue-400 hover:text-blue-300">
                Pełny rynek →
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
                <div className="text-[11px] text-slate-500">Fear & Greed</div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {marketNow.fearGreed === null ? "Brak" : marketNow.fearGreed.toFixed(1)}
                </div>
                <div className="text-[11px] text-slate-600">{marketNow.fearGreedLabel || "proxy AI"}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  {sentimentTrend.latestFearGreedDelta === null ? "trend neutral" : sentimentTrend.latestFearGreedDelta >= 0 ? "trend up" : "trend down"}
                </div>
                <div className="mt-2 flex items-end gap-1">
                  {sentimentTrend.fearGreed.length > 0 ? sentimentTrend.fearGreed.map((value, index) => (
                    <span
                      key={`fg-${index}`}
                      className="w-1.5 rounded-full bg-emerald-400/70"
                      style={{ height: `${Math.max(6, Math.min(24, value / 4))}px` }}
                      title={value.toFixed(1)}
                    />
                  )) : <div className="text-[10px] text-slate-600">Brak historii</div>}
                </div>
              </div>
              <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
                <div className="text-[11px] text-slate-500">VIX</div>
                <div className={`mt-1 text-lg font-semibold ${(marketNow.vix ?? 0) > 25 ? "text-red-400" : "text-slate-200"}`}>
                  {marketNow.vix?.toFixed(2) || "Brak"}
                </div>
                <div className="text-[11px] text-slate-600">
                  {vixTrend.latestDelta === null ? "zmienność rynku" : `${vixTrend.latestDelta >= 0 ? "+" : ""}${vixTrend.latestDelta.toFixed(2)} vs prev`}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  {vixTrend.latestDelta === null ? "trend neutral" : vixTrend.latestDelta >= 0 ? "trend up" : "trend down"}
                </div>
                <div className="mt-2 flex items-end gap-1">
                  {vixTrend.closes.length > 0 ? vixTrend.closes.map((value, index) => (
                    <span
                      key={`vix-${index}`}
                      className="w-1.5 rounded-full bg-red-400/70"
                      style={{ height: `${Math.max(6, Math.min(24, value / 2))}px` }}
                      title={value.toFixed(2)}
                    />
                  )) : <div className="text-[10px] text-slate-600">Brak historii</div>}
                </div>
              </div>
              <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
                <div className="text-[11px] text-slate-500">Put/Call Ratio</div>
                <div className="mt-1 text-lg font-semibold text-slate-200">
                  {marketNow.putCallRatio === null ? "Brak danych" : marketNow.putCallRatio.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-600">{marketNow.putCallType || "Cboe Total Put/Call"}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  {sentimentTrend.latestPutCallDelta === null ? "trend neutral" : sentimentTrend.latestPutCallDelta >= 0 ? "trend up" : "trend down"}
                </div>
                <div className="mt-2 flex items-end gap-1">
                  {sentimentTrend.putCall.length > 0 ? sentimentTrend.putCall.map((value, index) => (
                    <span
                      key={`pc-${index}`}
                      className="w-1.5 rounded-full bg-blue-400/70"
                      style={{ height: `${Math.max(6, Math.min(24, value * 18))}px` }}
                      title={value.toFixed(2)}
                    />
                  )) : <div className="text-[10px] text-slate-600">Brak historii</div>}
                </div>
              </div>
              <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
                <div className="text-[11px] text-slate-500">Advance / Decline</div>
                <div className="mt-1 text-lg font-semibold text-slate-200">
                  {marketNow.advanceDecline === null ? "Brak danych" : `${(marketNow.advanceDecline * 100).toFixed(0)}% / ${(100 - marketNow.advanceDecline * 100).toFixed(0)}%`}
                </div>
                <div className={`text-[11px] ${marketNow.breadthLabel === "risk-on" ? "text-emerald-400" : marketNow.breadthLabel === "risk-off" ? "text-red-400" : "text-slate-600"}`}>
                  {marketNow.breadthLabel}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  {sentimentTrend.latestBreadthDelta === null ? "trend neutral" : sentimentTrend.latestBreadthDelta >= 0 ? "trend up" : "trend down"}
                </div>
                <div className="mt-2 flex items-end gap-1">
                  {sentimentTrend.breadth.length > 0 ? sentimentTrend.breadth.map((value, index) => (
                    <span
                      key={`breadth-${index}`}
                      className="w-1.5 rounded-full bg-emerald-400/70"
                      style={{ height: `${Math.max(6, Math.min(24, value * 24))}px` }}
                      title={value.toFixed(2)}
                    />
                  )) : <div className="text-[10px] text-slate-600">Brak historii</div>}
                </div>
              </div>
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-3">
              <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
                <div className="text-[11px] text-slate-500">Najsilniejszy sektor</div>
                <div className="mt-1 text-sm font-medium text-emerald-300">{strongestSector?.sector || "Brak danych"}</div>
                {strongestSector && (
                  <div className="mt-1 text-xs text-slate-500">{strongestSector.best_ticker || "—"} • {strongestSector.avg_change_pct >= 0 ? "+" : ""}{strongestSector.avg_change_pct.toFixed(2)}%</div>
                )}
              </div>
              <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
                <div className="text-[11px] text-slate-500">Najsłabszy sektor</div>
                <div className="mt-1 text-sm font-medium text-red-300">{weakestSector?.sector || "Brak danych"}</div>
                {weakestSector && (
                  <div className="mt-1 text-xs text-slate-500">{weakestSector.worst_ticker || "—"} • {weakestSector.avg_change_pct.toFixed(2)}%</div>
                )}
              </div>
              <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
                <div className="text-[11px] text-slate-500">Przepływ kapitału</div>
                <div className={`mt-1 text-sm font-medium ${marketNow.capitalFlow !== null && marketNow.capitalFlow >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                  {marketNow.capitalFlow === null ? "Brak danych" : `${marketNow.capitalFlow >= 0 ? "+" : ""}${marketNow.capitalFlow.toFixed(2)} pkt`}
                </div>
                <div className="mt-1 text-xs text-slate-500">proxy: różnica siły sektorów</div>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <TrendingUp size={15} className="text-blue-400" /> Portfolio decyzyjne
              </div>
              <button onClick={() => setActiveView("portfolio")} className="text-xs text-blue-400 hover:text-blue-300">
                Pełne portfolio →
              </button>
            </div>

            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 text-left font-medium">Spółka</th>
                    <th className="px-3 py-2 text-right font-medium">Cena</th>
                    <th className="px-3 py-2 text-right font-medium">P&L</th>
                    <th className="px-3 py-2 text-right font-medium">AI Score</th>
                    <th className="px-3 py-2 text-left font-medium">Rekomendacja</th>
                    <th className="px-3 py-2 text-left font-medium">Ryzyko</th>
                    <th className="px-3 py-2 text-left font-medium">Wyniki</th>
                    <th className="px-3 py-2 text-right font-medium">Stop loss</th>
                    <th className="px-3 py-2 text-right font-medium">Take profit</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolio.slice(0, 8).map((item) => {
                    const pnlPct = item.current_price ? ((item.current_price - item.purchase_price) / item.purchase_price) * 100 : 0;
                    const riskLabel = toRiskLabel(item.ai_score, item.adx);
                    const nextEarnings = earningsByTicker.get(item.ticker);
                    const recommendationLabel = scoreBand(item.ai_score);
                    return (
                      <tr
                        key={item.id}
                        className="cursor-pointer border-b border-slate-800/40 transition-colors hover:bg-slate-900/70"
                        onClick={() => {
                          openTicker(item.ticker);
                          setExplanation(
                            buildExplanationFromPortfolio(
                              item,
                              nextEarnings,
                              filingsByTicker.get(item.ticker) || [],
                              alerts,
                              strongestSector?.sector || null
                            )
                          );
                        }}
                      >
                        <td className="px-3 py-3">
                          <div className="text-sm font-medium text-white">{item.ticker}</div>
                          <div className="text-[11px] text-slate-500">{item.company_name}</div>
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-sm text-slate-200">{formatCurrency(item.current_price || item.purchase_price, item.currency)}</td>
                        <td className="px-3 py-3 text-right">
                          <PriceChange value={pnlPct} className="text-xs" />
                          <TrendLabel delta={pnlPct} />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className={`text-sm font-semibold ${recommendationTone(recommendationLabel)}`}>{(item.ai_score ?? 0).toFixed(0)}</div>
                          <TrendLabel signal={recommendationLabel} />
                          <div className="text-[10px] text-slate-600">{recommendationFromScore(item.ai_score)}</div>
                        </td>
                        <td className="px-3 py-3">
                          <RecommendationBadge label={recommendationLabel} />
                        </td>
                        <td className={`px-3 py-3 text-xs ${riskTone(riskLabel)}`}>{riskLabel}</td>
                        <td className="px-3 py-3 text-xs text-slate-400">{nextEarnings ? `za ${formatDaysUntil(nextEarnings.event_date)}` : "brak daty"}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-slate-300">{formatCurrency(getStopLoss(item), item.currency)}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-slate-300">{formatCurrency(getTakeProfit(item), item.currency)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 lg:hidden">
              {portfolio.slice(0, 6).map((item) => {
                const pnlPct = item.current_price ? ((item.current_price - item.purchase_price) / item.purchase_price) * 100 : 0;
                const nextEarnings = earningsByTicker.get(item.ticker);
                const riskLabel = toRiskLabel(item.ai_score, item.adx);
                const recommendationLabel = scoreBand(item.ai_score);

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      openTicker(item.ticker);
                      setExplanation(
                        buildExplanationFromPortfolio(
                          item,
                          nextEarnings,
                          filingsByTicker.get(item.ticker) || [],
                          alerts,
                          strongestSector?.sector || null
                        )
                      );
                    }}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-white">{item.ticker}</div>
                        <div className="text-[11px] text-slate-500">{item.company_name}</div>
                      </div>
                      <RecommendationBadge label={recommendationLabel} />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-md bg-slate-950/60 p-2">
                        <div className="text-slate-500">Cena / P&L</div>
                        <div className="mt-1 font-mono text-slate-200">{formatCurrency(item.current_price || item.purchase_price, item.currency)}</div>
                        <div className="mt-1"><PriceChange value={pnlPct} className="text-xs" /></div>
                        <div className="mt-1"><TrendLabel delta={pnlPct} /></div>
                      </div>
                      <div className="rounded-md bg-slate-950/60 p-2">
                        <div className="text-slate-500">AI Score / Ryzyko</div>
                        <div className={`mt-1 font-semibold ${recommendationTone(recommendationLabel)}`}>{(item.ai_score ?? 0).toFixed(0)}</div>
                        <div className="mt-1"><TrendLabel signal={recommendationLabel} /></div>
                        <div className={`mt-1 ${riskTone(riskLabel)}`}>{riskLabel}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <DashboardOpportunities
            bestOpportunities={bestOpportunities}
            worstOpportunities={worstOpportunities}
            onOpenScanner={() => setActiveView("scanner")}
            onInspect={inspectRankedItem}
            onOpenTicker={openTicker}
          />

          <DashboardHeatmap
            groupedHeatmap={groupedHeatmap}
            onOpenMarket={() => setActiveView("market")}
            onOpenTicker={openTicker}
          />
        </div>

        <div className="space-y-4">
          <DashboardExplanation explanation={explanation} onOpenTicker={openTicker} />

          <DashboardEventsCalendar
            events={events}
            earnings={earnings}
            onOpenTicker={openTicker}
            onOpenMarket={() => setActiveView("market")}
          />

          <DashboardSnapshot
            secFilings={secFilings}
            onOpenSec={() => setActiveView("sec")}
            onOpenEarnings={() => setActiveView("earnings")}
            onOpenTicker={openTicker}
          />

          <DashboardPerformance performance={performance} />

          <div className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <Bell size={15} className="text-blue-400" /> Alerty
              </div>
              <button onClick={() => setActiveView("alerts")} className="text-xs text-blue-400 hover:text-blue-300">
                Wszystkie →
              </button>
            </div>
            <div className="space-y-2">
              {alerts.slice(0, 6).map((alert) => (
                <div key={alert.id} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle
                      size={14}
                      className={
                        alert.severity === "critical" ? "mt-0.5 text-red-400" :
                        alert.severity === "warning" ? "mt-0.5 text-amber-400" :
                        "mt-0.5 text-blue-400"
                      }
                    />
                    <div className="min-w-0">
                      <div className="text-sm text-slate-300">{alert.message}</div>
                      <div className="mt-1 text-[11px] text-slate-600">{new Date(alert.created_at).toLocaleString("pl-PL")}</div>
                    </div>
                  </div>
                </div>
              ))}
              {alerts.length === 0 && <div className="text-sm text-slate-600">Brak aktywnych alertów.</div>}
            </div>
          </div>
        </div>
      </div>

      {report && (
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <FileText size={15} className="text-blue-400" /> Ostatni raport AI
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded border px-2 py-0.5 text-xs ${
                report.market_sentiment === "risk_on" ? "border-emerald-700/50 bg-emerald-900/20 text-emerald-400" :
                report.market_sentiment === "risk_off" ? "border-red-700/50 bg-red-900/20 text-red-400" :
                "border-slate-700/50 text-slate-400"
              }`}>
                {report.market_sentiment?.replace("_", "-").toUpperCase()}
              </span>
              <button onClick={() => setActiveView("reports")} className="text-xs text-blue-400 hover:text-blue-300">
                Historia →
              </button>
            </div>
          </div>
          <div className="text-[11px] text-slate-500">{new Date(report.created_at).toLocaleString("pl-PL")} • {report.report_type}</div>
          <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-300">
            {report.content.slice(0, 1000)}{report.content.length > 1000 ? "..." : ""}
          </div>
        </div>
      )}
    </div>
  );
}
