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
  buildReportSections,
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
  toActionLabel,
  toRiskLabel,
} from "@/components/views/dashboard-utils";
import { useDashboardData } from "@/components/views/useDashboardData";
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
  const technicalReasons: string[] = [];
  const fundamentalReasons: string[] = [];
  const risks: string[] = [];
  const context: string[] = [];

  if ((item.volume ?? 0) > ((item.avg_volume ?? Infinity) * 1.5)) {
    technicalReasons.push(`wzrost wolumenu +${(((item.volume || 0) / Math.max(item.avg_volume || 1, 1)) * 100 - 100).toFixed(0)}%`);
  }
  if (item.signal_sma === "bullish" || item.signal_ema === "bullish") {
    technicalReasons.push("trend powyżej kluczowych średnich");
  }
  if (item.signal_macd === "bullish") {
    technicalReasons.push("pozytywny sygnał MACD");
  } else if (item.signal_macd === "bearish") {
    risks.push("MACD bearish");
  }
  if ((item.rsi_14 ?? 50) >= 45 && (item.rsi_14 ?? 50) <= 65) {
    technicalReasons.push(`RSI w zdrowym zakresie (${(item.rsi_14 ?? 0).toFixed(1)})`);
  } else if ((item.rsi_14 ?? 50) < 35) {
    technicalReasons.push(`RSI w strefie wyprzedania (${(item.rsi_14 ?? 0).toFixed(1)})`);
  } else if ((item.rsi_14 ?? 50) > 70) {
    risks.push("RSI blisko wykupienia");
  }
  if ((item.news_sentiment_score ?? 0) >= 20) {
    fundamentalReasons.push("pozytywne newsy i sentyment");
  }
  if (earnings) {
    context.push(`wyniki za ${formatDaysUntil(earnings.event_date)}`);
  }
  if (secFilings.length > 0) {
    fundamentalReasons.push(`brak negatywnego filing SEC (${secFilings[0].form})`);
  }
  if (alerts.some((alert) => alert.ticker === item.ticker && alert.severity === "warning")) {
    context.push("aktywny alert ryzyka");
    risks.push("aktywny alert ryzyka");
  }
  if (sectorLeader) {
    context.push(`sektor lidera: ${sectorLeader}`);
  }
  if ((item.change_pct ?? 0) < 0) {
    risks.push("słabnący momentum");
  }

  reasons.push(...technicalReasons, ...fundamentalReasons);
  const stopLoss = getStopLoss(item);
  const takeProfit = getTakeProfit(item);

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
      takeProfit ? `BUY po wybiciu powyżej ${formatCurrency(takeProfit, item.currency)} przy rosnącym wolumenie.` : "",
      stopLoss ? `REDUCE po zejściu poniżej ${formatCurrency(stopLoss, item.currency)}.` : "",
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
  reasons.push(...technicalReasons, ...fundamentalReasons);

  return {
    ticker: item.ticker,
    companyName: item.company_name || item.ticker,
    aiScore: item.ai_score ?? 0,
    recommendation: scoreLabel,
    actionLabel: mode === "best" ? "BUY" : "REDUCE",
    probability: mode === "best"
      ? clamp(Math.round((item.ai_score ?? 0) * 0.8), 22, 93)
      : clamp(Math.round((100 - (item.ai_score ?? 0)) * 0.72), 15, 84),
    riskLabel: mode === "best"
      ? ((item.ai_score ?? 0) >= 80 ? "Niskie" : (item.ai_score ?? 0) >= 65 ? "Średnie" : "Wysokie")
      : ((item.ai_score ?? 0) <= 25 ? "Wysokie" : "Średnie"),
    reasons: Array.from(new Set(reasons)).slice(0, 5),
    risks: risks.slice(0, 3),
    technicalReasons: technicalReasons.slice(0, 3),
    fundamentalReasons: fundamentalReasons.slice(0, 3),
    changeTriggers: mode === "best"
      ? ["BUY po utrzymaniu siły i dalszym wzroście wolumenu.", "REDUCE przy utracie lokalnego wsparcia."]
      : ["BUY dopiero po poprawie AI Score i momentum.", "REDUCE / SELL przy dalszym osłabieniu ceny."],
    marketContext: context.slice(0, 4),
  };
}

export default function Dashboard() {
  const {
    analysisRunning,
    alerts,
    aiInsights,
    bestOpportunities,
    fetchAll,
    events,
    filingsByTicker,
    groupedHeatmap,
    earnings,
    earningsByTicker,
    explanation,
    inspectRankedItem,
    indices,
    lastRun,
    loading,
    marketDecision,
    marketNow,
    marketSentiment,
    marketSentimentData,
    mobileAccordion,
    performance,
    portfolio,
    report,
    reportDecisionSummary,
    reportSections,
    runAnalysis,
    secFilings,
    setActiveView,
    setExplanation,
    setSelectedTicker,
    sentimentTrend,
    strongestSector,
    totalPortfolioValue,
    totalPnL,
    totalPnLPct,
    toggleAccordion,
    vixTrend,
    watchlistActivity,
    watchlist,
    worstOpportunities,
    weakestSector,
    qqq,
    spy,
    vix,
    keyIndices,
    marketSentimentData: marketSentimentDataRef,
  } = useDashboardData();

  const openTicker = (ticker: string | null | undefined) => {
    if (!ticker) return;
    setSelectedTicker(ticker);
    setActiveView("ticker");
  };

  const openInsight = (item: InsightItem) => {
    if (item.sourceTicker) openTicker(item.sourceTicker);
    else setActiveView(item.sourceView);
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
        marketDecision.status === "BULLISH"
          ? "border-emerald-800/50 bg-emerald-900/10"
          : marketDecision.status === "RISK-OFF" || marketDecision.status === "BEARISH"
            ? "border-red-800/50 bg-red-900/10"
            : "border-slate-700/50 bg-slate-900/40"
      }`}>
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">AI Market Status</div>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <div className={`text-3xl font-semibold ${
                marketDecision.status === "BULLISH" ? "text-emerald-400" :
                marketDecision.status === "RISK-OFF" || marketDecision.status === "BEARISH" ? "text-red-400" : "text-slate-200"
              }`}>
                {marketDecision.status}
              </div>
              <div className="text-xl font-semibold text-white">{marketDecision.score}/100</div>
            </div>
            <div className="mt-3 text-sm font-medium text-white">Decyzja: {marketDecision.action}</div>
            <div className="mt-3 grid gap-2">
              {marketDecision.reasons.map((reason) => (
                <div key={reason} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className={reason.toLowerCase().includes("brak") || reason.toLowerCase().includes("ryzy") || reason.toLowerCase().includes("ostrzega") ? "mt-0.5 text-red-400" : "mt-0.5 text-emerald-400"}>
                    {reason.toLowerCase().includes("brak") || reason.toLowerCase().includes("ryzy") || reason.toLowerCase().includes("ostrzega") ? "✗" : "✓"}
                  </span>
                  <span>{reason}</span>
                </div>
              ))}
              {marketDecision.technicalNotes.map((note) => (
                <div key={note} className="text-xs text-slate-500">{note}</div>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
              <div className="text-[11px] text-slate-500">S&P 500 / Nasdaq / VIX</div>
              <div className="mt-1 text-sm text-white">
                {spy?.value ? formatCurrency(spy.value) : "Brak danych"} • {qqq?.value ? formatCurrency(qqq.value) : "Brak danych"} • {vix?.value?.toFixed(2) || "Brak danych"}
              </div>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
              <div className="text-[11px] text-slate-500">Breadth / Fear & Greed</div>
              <div className="mt-1 text-sm text-white">
                {marketNow.advanceDecline === null ? "Brak breadth" : `${(marketNow.advanceDecline * 100).toFixed(0)}% green`} • {marketNow.fearGreed === null ? "Brak F&G" : `${marketNow.fearGreed.toFixed(0)}/100`}
              </div>
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
              <div className="text-[11px] text-slate-500">Co robić teraz?</div>
              <div className="mt-1 text-sm text-white">{marketDecision.action}</div>
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
                <div className="text-[11px] text-slate-500">AI Market Status</div>
                <div className="mt-1 text-sm font-medium text-white">{marketDecision.status}</div>
                <div className="mt-1 text-[11px] text-slate-600">{marketDecision.score}/100</div>
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

      <div className="hidden xl:grid xl:grid-cols-[1.6fr,1fr] xl:gap-4">
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
            {portfolio.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-800 bg-slate-950/40 px-3 py-4 text-sm text-slate-500">
                Brak aktywnych pozycji. Dodaj spółkę do portfolio lub watchlisty, aby zbudować rekomendacje.
              </div>
            ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {portfolio.slice(0, 6).map((item) => {
                const pnlPct = item.current_price ? ((item.current_price - item.purchase_price) / item.purchase_price) * 100 : 0;
                const nextEarnings = earningsByTicker.get(item.ticker);
                const riskLabel = toRiskLabel(item.ai_score, item.adx);
                const recommendationLabel = scoreBand(item.ai_score);
                const explanationCard = buildExplanationFromPortfolio(
                  item,
                  nextEarnings,
                  filingsByTicker.get(item.ticker) || [],
                  alerts,
                  strongestSector?.sector || null
                );

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      openTicker(item.ticker);
                      setExplanation(explanationCard);
                    }}
                    className="w-full rounded-lg border border-slate-800 bg-slate-900/60 p-4 text-left transition-colors hover:border-slate-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-base font-semibold text-white">{item.ticker} — {explanationCard.actionLabel}</div>
                        <div className="text-[11px] text-slate-500">{item.company_name}</div>
                      </div>
                      <RecommendationBadge label={recommendationLabel} />
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4 text-xs">
                      <div className="rounded-md bg-slate-950/60 p-2">
                        <div className="text-slate-500">Cena</div>
                        <div className="mt-1 font-mono text-slate-200">{formatCurrency(item.current_price || item.purchase_price, item.currency)}</div>
                      </div>
                      <div className="rounded-md bg-slate-950/60 p-2">
                        <div className="text-slate-500">AI Score</div>
                        <div className={`mt-1 font-semibold ${recommendationTone(recommendationLabel)}`}>{(item.ai_score ?? 0).toFixed(0)}</div>
                      </div>
                      <div className="rounded-md bg-slate-950/60 p-2">
                        <div className="text-slate-500">Trend / Ryzyko</div>
                        <div className="mt-1"><TrendLabel signal={recommendationLabel} /></div>
                        <div className={`mt-1 ${riskTone(riskLabel)}`}>{riskLabel}</div>
                      </div>
                      <div className="rounded-md bg-slate-950/60 p-2">
                        <div className="text-slate-500">Stop / Take</div>
                        <div className="mt-1 font-mono text-slate-200">{formatCurrency(getStopLoss(item), item.currency)}</div>
                        <div className="mt-1 font-mono text-slate-400">{formatCurrency(getTakeProfit(item), item.currency)}</div>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                        <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">Powody</div>
                        <div className="space-y-1.5">
                          {explanationCard.reasons.slice(0, 3).map((reason) => (
                            <div key={reason} className="flex items-start gap-2 text-sm text-slate-300">
                              <span className="mt-0.5 text-emerald-400">✓</span>
                              <span>{reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                        <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">Ryzyka</div>
                        <div className="space-y-1.5">
                          {(explanationCard.risks || ["Brak dominującego ryzyka poza zmiennością rynku."]).slice(0, 2).map((risk) => (
                            <div key={risk} className="flex items-start gap-2 text-sm text-slate-300">
                              <span className="mt-0.5 text-red-400">✗</span>
                              <span>{risk}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      <span>Wyniki: {nextEarnings ? `za ${formatDaysUntil(nextEarnings.event_date)}` : "brak daty"}</span>
                      <span>P&L: <PriceChange value={pnlPct} className="inline text-xs" /></span>
                    </div>
                  </button>
                );
              })}
            </div>
            )}
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
              {alerts.length > 0 ? alerts.slice(0, 6).map((alert) => (
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
              )) : (
                <div className="rounded-md border border-dashed border-slate-800 bg-slate-950/40 px-3 py-4 text-sm text-slate-500">
                  Brak aktywnych sygnałów. Uruchom analizę lub rozszerz watchlistę.
                </div>
              )}
            </div>
          </div>

          <DashboardExplanation explanation={explanation} onOpenTicker={openTicker} />

          <DashboardSnapshot
            secFilings={secFilings}
            onOpenSec={() => setActiveView("sec")}
            onOpenEarnings={() => setActiveView("earnings")}
            onOpenTicker={openTicker}
          />

          <DashboardPerformance performance={performance} />

          <DashboardEventsCalendar
            events={events}
            earnings={earnings}
            onOpenTicker={openTicker}
            onOpenMarket={() => setActiveView("market")}
          />
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
          <div className="mt-4 grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Skrót decyzyjny</div>
              <div className="mt-2 text-sm text-white">Decyzja: {reportDecisionSummary.decision}</div>
              <div className="mt-2 text-sm text-slate-300">Pewność: {reportDecisionSummary.certainty}%</div>
              <div className="mt-3 text-xs text-slate-500">Największe ryzyko</div>
              <div className="mt-1 text-sm text-slate-300">{reportDecisionSummary.biggestRisk}</div>
              <div className="mt-3 text-xs text-slate-500">Największa szansa</div>
              <div className="mt-1 text-sm text-slate-300">{reportDecisionSummary.biggestChance}</div>
            </div>
            <div className="space-y-3">
              {(reportSections.length > 0 ? reportSections : [{ title: "Raport AI", body: report.content }]).map((section) => (
                <div key={section.title} className="rounded-md border border-slate-800 bg-slate-950/40 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-500">{section.title}</div>
                  <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300">
                    {section.body.slice(0, 360)}{section.body.length > 360 ? "..." : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
