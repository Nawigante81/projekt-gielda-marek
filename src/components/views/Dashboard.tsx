"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { RefreshCw, Play, TrendingUp, Eye, Bell, FileText, AlertCircle, Loader2 } from "lucide-react";
import SignalBadge from "@/components/SignalBadge";
import PriceChange from "@/components/PriceChange";
import toast from "react-hot-toast";

interface MarketIndex {
  symbol: string;
  name: string;
  value: number | null;
  change_pct: number | null;
  trend: string;
  market_status: string;
  last_updated: string;
}

interface PortfolioItem {
  id: number;
  ticker: string;
  company_name: string;
  shares: number;
  purchase_price: number;
  current_price: number | null;
  change_pct: number | null;
  overall_signal: string | null;
  rsi_14: number | null;
}

interface Alert {
  id: number;
  ticker: string;
  alert_type: string;
  severity: string;
  message: string;
  created_at: string;
  is_read: number;
}

interface Report {
  id: number;
  content: string;
  market_sentiment: string;
  created_at: string;
  report_type: string;
}

interface RankedItem {
  ticker: string;
  company_name: string;
  price: number;
  change_pct: number;
  ai_score: number;
  recommendation: string;
}

interface PerformanceSummary {
  total: number;
  successRate: number;
  averageReturn: number;
  accurateCount: number;
  missCount: number;
}

interface HeatmapTile {
  ticker: string;
  company_name: string;
  change_pct: number;
  ai_score: number;
  recommendation: string;
}

interface MarketEvent {
  id: number;
  title: string;
  ticker: string | null;
  event_type: string;
  event_date: string;
}

const INDEX_ICONS: Record<string, string> = {
  "SPY": "📈", "QQQ": "💻", "DIA": "🏛️", "IWM": "🏢",
  "^VIX": "⚡", "GC=F": "🥇", "CL=F": "🛢️",
  "BTC-USD": "₿", "ETH-USD": "⟠",
};

const KEY_INDICES = ["SPY", "QQQ", "DIA", "IWM", "^VIX", "GC=F", "CL=F", "BTC-USD"];

export default function Dashboard() {
  const { setActiveView, setSelectedTicker, analysisRunning, setAnalysisRunning } = useAppStore();
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [rankings, setRankings] = useState<{ topBuy: RankedItem[]; topSell: RankedItem[]; topMomentum: RankedItem[] }>({ topBuy: [], topSell: [], topMomentum: [] });
  const [performance, setPerformance] = useState<PerformanceSummary | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapTile[]>([]);
  const [calendar, setCalendar] = useState<{ today: MarketEvent[]; thisWeek: MarketEvent[] } | null>(null);
  const [watchlistActivity, setWatchlistActivity] = useState({ total: 0, autoAnalyze: 0, withAlerts: 0 });
  const [loading, setLoading] = useState(true);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [mktRes, portRes, alertRes, repRes, statusRes, rankingsRes, performanceRes, heatmapRes, calendarRes, watchRes] = await Promise.all([
        fetch("/api/market"),
        fetch("/api/portfolio"),
        fetch("/api/alerts?unread=true&limit=5"),
        fetch("/api/reports"),
        fetch("/api/analysis/run"),
        fetch("/api/rankings?limit=5"),
        fetch("/api/performance"),
        fetch("/api/heatmap?index=SP500"),
        fetch("/api/market-events"),
        fetch("/api/watchlist"),
      ]);

      if (mktRes.ok) setIndices(await mktRes.json());
      if (portRes.ok) setPortfolio(await portRes.json());
      if (alertRes.ok) {
        const a = await alertRes.json();
        setAlerts(a);
        useAppStore.getState().setUnreadAlerts(a.length);
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
        });
      }
      if (performanceRes.ok) {
        const data = await performanceRes.json();
        setPerformance(data.summary || null);
      }
      if (heatmapRes.ok) {
        const data = await heatmapRes.json();
        setHeatmap(data.tiles || []);
      }
      if (calendarRes.ok) {
        const data = await calendarRes.json();
        setCalendar({ today: data.buckets?.today || [], thisWeek: data.buckets?.thisWeek || [] });
      }
      if (watchRes.ok) {
        const watchlist = await watchRes.json();
        setWatchlistActivity({
          total: watchlist.length,
          autoAnalyze: watchlist.filter((item: { auto_analyze?: number }) => item.auto_analyze === 1).length,
          withAlerts: watchlist.filter((item: { latest_alert?: string | null }) => Boolean(item.latest_alert)).length,
        });
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [setAnalysisRunning]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60000); // refresh every minute
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
        toast.success("Analiza uruchomiona w tle!", { id: "analysis" });
        setTimeout(fetchAll, 5000);
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
    return sum + price * item.shares;
  }, 0);

  const totalPnL = portfolio.reduce((sum, item) => {
    const price = item.current_price || item.purchase_price;
    return sum + (price - item.purchase_price) * item.shares;
  }, 0);

  const totalCost = portfolio.reduce((sum, item) => sum + item.purchase_price * item.shares, 0);
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const keyIndices = indices.filter(i => KEY_INDICES.includes(i.symbol));
  const vix = indices.find(i => i.symbol === "^VIX");
  const spy = indices.find(i => i.symbol === "SPY");
  const marketSentiment = vix && spy
    ? (vix.value && vix.value > 25 ? "risk-off" : spy.change_pct && spy.change_pct > 0.5 ? "risk-on" : "neutral")
    : "neutral";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {lastRun ? `Ostatnia analiza: ${new Date(lastRun).toLocaleString("pl-PL")}` : "Brak analizy"}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          <button
            onClick={fetchAll}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
            title="Odśwież"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={runAnalysis}
            disabled={analysisRunning}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${analysisRunning
                ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white"
              }
            `}
          >
            {analysisRunning ? (
              <><Loader2 size={14} className="animate-spin" /> Analizuję...</>
            ) : (
              <><Play size={14} /> Uruchom analizę</>
            )}
          </button>
        </div>
      </div>

      {/* Market Sentiment Strip */}
      <div className={`card p-3 flex items-center gap-4 text-sm ${
        marketSentiment === "risk-on" ? "border-emerald-800/50 bg-emerald-900/10" :
        marketSentiment === "risk-off" ? "border-red-800/50 bg-red-900/10" :
        "border-slate-700/50"
      }`}>
        <span className="text-slate-400">Sentyment rynku:</span>
        <span className={`font-semibold ${
          marketSentiment === "risk-on" ? "text-emerald-400" :
          marketSentiment === "risk-off" ? "text-red-400" :
          "text-slate-300"
        }`}>
          {marketSentiment.toUpperCase()}
        </span>
        {vix && vix.value && (
          <span className="text-slate-500">VIX: <span className="text-slate-300">{vix.value.toFixed(2)}</span></span>
        )}
        {spy && spy.change_pct !== null && (
          <span className="text-slate-500">S&P 500: <PriceChange value={spy.change_pct} /></span>
        )}
      </div>

      {/* Portfolio Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs text-slate-500 mb-1">Wartość Portfolio</div>
          <div className="text-xl font-mono font-semibold text-white">
            ${totalPortfolioValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">{portfolio.length} pozycji</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500 mb-1">Całkowity P&L</div>
          <div className={`text-xl font-mono font-semibold ${totalPnL >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {totalPnL >= 0 ? "+" : ""}${Math.abs(totalPnL).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={`text-xs mt-1 ${totalPnLPct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            {totalPnLPct >= 0 ? "+" : ""}{totalPnLPct.toFixed(2)}%
          </div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-slate-500 mb-1">Aktywne Alerty</div>
          <div className="text-xl font-mono font-semibold text-amber-400">{alerts.length}</div>
          <div className="text-xs text-slate-500 mt-1">nieodczytanych</div>
        </div>
      </div>

      {/* Market Indices Grid */}
      <div>
        <h2 className="text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
          <TrendingUp size={14} /> Główne indeksy
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {keyIndices.map((idx) => (
            <div key={idx.symbol} className="card p-3 card-hover cursor-default">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-base">{INDEX_ICONS[idx.symbol] || "📊"}</span>
                <span className="text-xs text-slate-400 font-medium">{idx.name}</span>
              </div>
              <div className="font-mono text-sm font-semibold text-white">
                {idx.value ? `$${idx.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
              </div>
              <PriceChange value={idx.change_pct} className="text-xs mt-0.5" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-slate-300">Najlepsze okazje</div>
            <button onClick={() => setActiveView("technicals")} className="text-blue-400 hover:text-blue-300 text-xs">Ranking →</button>
          </div>
          <div className="space-y-2">
            {rankings.topBuy.map((item) => (
              <button key={item.ticker} onClick={() => { setSelectedTicker(item.ticker); setActiveView("ticker"); }} className="w-full text-left rounded-md border border-slate-800 bg-slate-900/60 p-3 hover:border-blue-500/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white font-medium">{item.ticker}</div>
                    <div className="text-[11px] text-slate-500">{item.company_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-emerald-400 font-mono">{item.ai_score.toFixed(1)}</div>
                    <div className="text-[10px] text-slate-500">{item.recommendation}</div>
                  </div>
                </div>
                <div className="mt-2 text-xs"><PriceChange value={item.change_pct} /></div>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-slate-300">Najgorsze okazje</div>
            <button onClick={() => setActiveView("technicals")} className="text-blue-400 hover:text-blue-300 text-xs">Ranking →</button>
          </div>
          <div className="space-y-2">
            {rankings.topSell.map((item) => (
              <button key={item.ticker} onClick={() => { setSelectedTicker(item.ticker); setActiveView("ticker"); }} className="w-full text-left rounded-md border border-slate-800 bg-slate-900/60 p-3 hover:border-blue-500/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-white font-medium">{item.ticker}</div>
                    <div className="text-[11px] text-slate-500">{item.company_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-red-400 font-mono">{item.ai_score.toFixed(1)}</div>
                    <div className="text-[10px] text-slate-500">{item.recommendation}</div>
                  </div>
                </div>
                <div className="mt-2 text-xs"><PriceChange value={item.change_pct} /></div>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-slate-300">Skuteczność AI</div>
            <button onClick={() => setActiveView("ticker")} className="text-blue-400 hover:text-blue-300 text-xs">Szczegóły →</button>
          </div>
          {performance ? (
            <div className="space-y-3">
              <div>
                <div className="text-2xl font-semibold text-white">{performance.successRate.toFixed(1)}%</div>
                <div className="text-xs text-slate-500">średnia skuteczność rekomendacji</div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-slate-900/70 p-3">
                  <div className="text-slate-500">Średni zwrot</div>
                  <div className={`font-semibold ${performance.averageReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>{performance.averageReturn.toFixed(2)}%</div>
                </div>
                <div className="rounded-md bg-slate-900/70 p-3">
                  <div className="text-slate-500">Śledzone</div>
                  <div className="font-semibold text-white">{performance.total}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-600">Brak danych performance.</div>
          )}
        </div>

        <div className="card p-4">
          <div className="text-sm font-medium text-slate-300 mb-3">Aktywność watchlisty</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-md bg-slate-900/70 p-3">
              <div className="text-slate-500">Tickery</div>
              <div className="text-white font-semibold mt-1">{watchlistActivity.total}</div>
            </div>
            <div className="rounded-md bg-slate-900/70 p-3">
              <div className="text-slate-500">Auto analiza</div>
              <div className="text-emerald-400 font-semibold mt-1">{watchlistActivity.autoAnalyze}</div>
            </div>
            <div className="rounded-md bg-slate-900/70 p-3">
              <div className="text-slate-500">Z alertami</div>
              <div className="text-amber-400 font-semibold mt-1">{watchlistActivity.withAlerts}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr,1fr]">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-slate-300">Heatmapa rynku</div>
            <button onClick={() => setActiveView("market")} className="text-blue-400 hover:text-blue-300 text-xs">Pełny widok →</button>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {heatmap.slice(0, 12).map((tile) => (
              <button
                key={tile.ticker}
                onClick={() => { setSelectedTicker(tile.ticker); setActiveView("ticker"); }}
                className={`rounded-md border p-3 text-left transition-colors ${tile.change_pct >= 0 ? "border-emerald-800/40 bg-emerald-500/10" : "border-red-800/40 bg-red-500/10"}`}
              >
                <div className="text-sm font-semibold text-white">{tile.ticker}</div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate">{tile.company_name}</div>
                <div className="mt-2 text-xs"><PriceChange value={tile.change_pct} /></div>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium text-slate-300">Kalendarz wydarzeń</div>
            <button onClick={() => setActiveView("market")} className="text-blue-400 hover:text-blue-300 text-xs">Więcej →</button>
          </div>
          <div className="space-y-3 text-xs">
            <div>
              <div className="text-slate-500 mb-1">Dzisiaj</div>
              <div className="space-y-1">
                {(calendar?.today || []).slice(0, 4).map((event) => (
                  <div key={`today-${event.id}`} className="rounded-md bg-slate-900/70 p-2">
                    <div className="text-white">{event.ticker ? `${event.ticker} • ` : ""}{event.title}</div>
                    <div className="text-slate-500 mt-0.5">{event.event_type}</div>
                  </div>
                ))}
                {(calendar?.today || []).length === 0 && <div className="text-slate-600">Brak wydarzeń na dziś</div>}
              </div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">Ten tydzień</div>
              <div className="space-y-1">
                {(calendar?.thisWeek || []).slice(0, 5).map((event) => (
                  <div key={`week-${event.id}`} className="rounded-md bg-slate-900/70 p-2">
                    <div className="text-white">{event.ticker ? `${event.ticker} • ` : ""}{event.title}</div>
                    <div className="text-slate-500 mt-0.5">{new Date(event.event_date).toLocaleDateString("pl-PL")} • {event.event_type}</div>
                  </div>
                ))}
                {(calendar?.thisWeek || []).length === 0 && <div className="text-slate-600">Brak wydarzeń w tym tygodniu</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Portfolio Table */}
        <div>
          <h2 className="text-sm font-medium text-slate-400 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2"><TrendingUp size={14} /> Portfolio</span>
            <button onClick={() => setActiveView("portfolio")} className="text-blue-400 hover:text-blue-300 text-xs">
              Pokaż wszystkie →
            </button>
          </h2>
          <div className="card overflow-hidden hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="text-left px-3 py-2 text-xs text-slate-500 font-medium">Ticker</th>
                  <th className="text-right px-3 py-2 text-xs text-slate-500 font-medium">Cena</th>
                  <th className="text-right px-3 py-2 text-xs text-slate-500 font-medium">P&L%</th>
                  <th className="text-right px-3 py-2 text-xs text-slate-500 font-medium">Sygnał</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.slice(0, 6).map((item) => {
                  const pnlPct = item.current_price
                    ? ((item.current_price - item.purchase_price) / item.purchase_price) * 100
                    : 0;
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 cursor-pointer"
                      onClick={() => { setSelectedTicker(item.ticker); setActiveView("ticker"); }}
                    >
                      <td className="px-3 py-2">
                        <div className="text-sm font-medium text-white">{item.ticker}</div>
                        <div className="text-[10px] text-slate-500">{item.company_name}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-sm text-slate-300">
                        {item.current_price ? `$${item.current_price.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <PriceChange value={pnlPct} className="text-xs" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <SignalBadge signal={item.overall_signal} />
                      </td>
                    </tr>
                  );
                })}
                {portfolio.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-600">Brak pozycji w portfolio</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {portfolio.slice(0, 6).map((item) => {
              const pnlPct = item.current_price
                ? ((item.current_price - item.purchase_price) / item.purchase_price) * 100
                : 0;
              return (
                <button
                  key={item.id}
                  onClick={() => { setSelectedTicker(item.ticker); setActiveView("ticker"); }}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-white">{item.ticker}</div>
                      <div className="text-[11px] text-slate-500">{item.company_name}</div>
                    </div>
                    <SignalBadge signal={item.overall_signal} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-md bg-slate-950/60 p-2">
                      <div className="text-slate-500">Cena</div>
                      <div className="mt-1 font-mono text-slate-200">{item.current_price ? `$${item.current_price.toFixed(2)}` : "—"}</div>
                    </div>
                    <div className="rounded-md bg-slate-950/60 p-2">
                      <div className="text-slate-500">P&L%</div>
                      <div className="mt-1"><PriceChange value={pnlPct} className="text-xs" /></div>
                    </div>
                    <div className="rounded-md bg-slate-950/60 p-2">
                      <div className="text-slate-500">Sygnał</div>
                      <div className="mt-1 text-[11px] text-slate-300">{item.rsi_14 !== null ? `RSI ${item.rsi_14.toFixed(1)}` : "—"}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Alerts */}
        <div>
          <h2 className="text-sm font-medium text-slate-400 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2"><Bell size={14} /> Alerty</span>
            <button onClick={() => setActiveView("alerts")} className="text-blue-400 hover:text-blue-300 text-xs">
              Pokaż wszystkie →
            </button>
          </h2>
          <div className="card divide-y divide-slate-800/50">
            {alerts.slice(0, 6).map((alert) => (
              <div key={alert.id} className="px-3 py-2 flex items-start gap-2">
                <AlertCircle
                  size={12}
                  className={`mt-0.5 flex-shrink-0 ${
                    alert.severity === "critical" ? "text-red-400" :
                    alert.severity === "warning" ? "text-amber-400" :
                    "text-blue-400"
                  }`}
                />
                <div>
                  <div className="text-xs text-slate-300">{alert.message}</div>
                  <div className="text-[10px] text-slate-600 mt-0.5">
                    {new Date(alert.created_at).toLocaleString("pl-PL")}
                  </div>
                </div>
              </div>
            ))}
            {alerts.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-slate-600">Brak aktywnych alertów</div>
            )}
          </div>
        </div>
      </div>

      {/* Latest AI Report */}
      {report && (
        <div>
          <h2 className="text-sm font-medium text-slate-400 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2"><FileText size={14} /> Ostatni raport AI</span>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded border ${
                report.market_sentiment === "risk_on" ? "text-emerald-400 border-emerald-700/50 bg-emerald-900/20" :
                report.market_sentiment === "risk_off" ? "text-red-400 border-red-700/50 bg-red-900/20" :
                "text-slate-400 border-slate-700/50"
              }`}>
                {report.market_sentiment?.replace("_", "-").toUpperCase()}
              </span>
              <button onClick={() => setActiveView("reports")} className="text-blue-400 hover:text-blue-300 text-xs">
                Historia →
              </button>
            </div>
          </h2>
          <div className="card p-4">
            <div className="text-[10px] text-slate-500 mb-2">
              {new Date(report.created_at).toLocaleString("pl-PL")} • {report.report_type}
            </div>
            <div className="text-sm text-slate-300 whitespace-pre-line max-h-48 overflow-y-auto leading-relaxed">
              {report.content.slice(0, 800)}{report.content.length > 800 ? "..." : ""}
            </div>
          </div>
        </div>
      )}

      {!report && (
        <div className="card p-8 text-center">
          <FileText size={32} className="text-slate-700 mx-auto mb-3" />
          <div className="text-sm text-slate-500">Brak raportów AI. Uruchom analizę, aby wygenerować raport.</div>
          <button
            onClick={runAnalysis}
            disabled={analysisRunning}
            className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors disabled:opacity-50"
          >
            <Eye size={14} className="inline mr-1" />
            Uruchom pierwszą analizę
          </button>
        </div>
      )}
    </div>
  );
}
