"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { ArrowLeft, Loader2, ExternalLink } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import SignalBadge, { IndividualSignal } from "@/components/SignalBadge";
import PriceChange from "@/components/PriceChange";

interface TickerData {
  ticker: string;
  currentPrice: {
    price: number;
    change_pct: number;
    change_abs: number;
    volume: number;
    last_updated: string;
    source: string;
  } | null;
  technicals: {
    ai_score: number;
    recommendation: string;
    rsi_14: number;
    macd_line: number;
    macd_signal: number;
    macd_histogram: number;
    sma_20: number;
    sma_50: number;
    sma_200: number;
    ema_12: number;
    ema_26: number;
    bb_upper: number;
    bb_middle: number;
    bb_lower: number;
    stoch_k: number;
    stoch_d: number;
    adx: number;
    plus_di: number;
    minus_di: number;
    ichimoku_tenkan: number;
    ichimoku_kijun: number;
    fib_382: number;
    fib_618: number;
    signal_sma: string;
    signal_ema: string;
    signal_macd: string;
    signal_rsi: string;
    signal_bb: string;
    signal_stoch: string;
    signal_adx: string;
    signal_ichimoku: string;
    signal_fib: string;
    overall_signal: string;
    overall_score: number;
    calculated_at: string;
  } | null;
  history: Array<{ date: string; open: number; high: number; low: number; close: number; volume: number }>;
  news: Array<{ id: number; headline: string; source: string; url: string; published_at: string }>;
  sentiment: Array<{ id: number; score: number; label: string; impact_score: number; summary: string; created_at: string }>;
  alerts: Array<{ id: number; severity: string; message: string; created_at: string }>;
  analysisHistory: Array<{ id: number; price: number; score: number; recommendation: string; sentiment: number; created_at: string }>;
  performance: Array<{ id: number; recommendation: string; score: number; success_rate: number; average_return: number; return_7d: number | null; return_30d: number | null; return_90d: number | null; return_180d: number | null; accuracy_label: string }>;
  portfolioItem: { shares: number; purchase_price: number; purchase_date: string } | null;
  watchlistItem: { id: number } | null;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; color: string; name: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 rounded p-2 text-xs">
        <div className="text-slate-400 mb-1">{label}</div>
        {payload.map((entry, i) => (
          <div key={i} style={{ color: entry.color }}>
            {entry.name}: ${entry.value?.toFixed(2)}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function TickerDetail() {
  const { selectedTicker, setActiveView } = useAppStore();
  const [data, setData] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<"price" | "rsi" | "macd">("price");

  const fetchData = useCallback(async () => {
    if (!selectedTicker) return;
    const res = await fetch(`/api/ticker/${selectedTicker}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [selectedTicker]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!selectedTicker) return <div className="text-slate-500">Wybierz ticker</div>;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={24} /></div>;
  }

  if (!data) return <div className="text-slate-500">Brak danych dla {selectedTicker}</div>;

  const price = data.currentPrice;
  const tech = data.technicals;

  // Prepare chart data - last 60 bars
  const chartData = data.history.slice(-60).map(bar => ({
    date: bar.date.slice(5), // MM-DD
    close: bar.close,
    sma20: tech?.sma_20,
    volume: bar.volume,
  }));

  // RSI data
  const rsiData = data.history.slice(-60).map((bar, i) => ({
    date: bar.date.slice(5),
    rsi: i === data.history.slice(-60).length - 1 ? tech?.rsi_14 : null,
  }));

  const pnl = data.portfolioItem && price
    ? (price.price - data.portfolioItem.purchase_price) * data.portfolioItem.shares
    : null;
  const pnlPct = data.portfolioItem && price
    ? ((price.price - data.portfolioItem.purchase_price) / data.portfolioItem.purchase_price) * 100
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView("dashboard")}
            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{selectedTicker}</h1>
              {data.portfolioItem && (
                <span className="text-xs bg-blue-900/40 text-blue-400 px-2 py-0.5 rounded border border-blue-700/50">Portfolio</span>
              )}
              {data.watchlistItem && (
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">Watchlista</span>
              )}
            </div>
          </div>
        </div>
        {price && (
          <div className="text-right">
            <div className="text-2xl font-mono font-bold text-white">${price.price.toFixed(2)}</div>
            <PriceChange value={price.change_pct} className="text-sm" />
          </div>
        )}
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-4 gap-3">
        {price && (
          <>
            {tech && (
              <div className="card p-3">
                <div className="text-[10px] text-slate-500 mb-1">AI Score</div>
                <div className={`text-base font-mono font-semibold ${tech.ai_score >= 70 ? "text-emerald-400" : tech.ai_score < 40 ? "text-red-400" : "text-slate-200"}`}>
                  {tech.ai_score.toFixed(1)}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">{tech.recommendation}</div>
              </div>
            )}
            <div className="card p-3">
              <div className="text-[10px] text-slate-500 mb-1">Zmiana dzienna</div>
              <PriceChange value={price.change_abs} prefix="$" suffix="" className="text-base font-semibold" />
            </div>
            <div className="card p-3">
              <div className="text-[10px] text-slate-500 mb-1">Wolumen</div>
              <div className="text-base font-mono font-semibold text-slate-200">
                {(price.volume / 1e6).toFixed(2)}M
              </div>
            </div>
            {data.sentiment[0] && (
              <div className="card p-3">
                <div className="text-[10px] text-slate-500 mb-1">News Sentiment</div>
                <div className={`text-base font-mono font-semibold ${data.sentiment[0].label === "positive" ? "text-emerald-400" : data.sentiment[0].label === "negative" ? "text-red-400" : "text-slate-200"}`}>
                  {data.sentiment[0].score > 0 ? "+" : ""}{data.sentiment[0].score.toFixed(0)}
                </div>
                <div className="text-[10px] text-slate-500 mt-1">Impact: {data.sentiment[0].impact_score.toFixed(0)}</div>
              </div>
            )}
          </>
        )}
        {data.portfolioItem && price && (
          <>
            <div className="card p-3">
              <div className="text-[10px] text-slate-500 mb-1">P&L ($)</div>
              <div className={`text-base font-mono font-semibold ${pnl && pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {pnl !== null ? `${pnl >= 0 ? "+" : ""}$${Math.abs(pnl).toFixed(2)}` : "—"}
              </div>
            </div>
            <div className="card p-3">
              <div className="text-[10px] text-slate-500 mb-1">P&L (%)</div>
              <div className={`text-base font-mono font-semibold ${pnlPct && pnlPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {pnlPct !== null ? `${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%` : "—"}
              </div>
            </div>
          </>
        )}
        {!data.portfolioItem && tech && (
          <>
            <div className="card p-3">
              <div className="text-[10px] text-slate-500 mb-1">RSI (14)</div>
              <div className={`text-base font-mono font-semibold ${
                tech.rsi_14 > 70 ? "text-red-400" :
                tech.rsi_14 < 30 ? "text-emerald-400" : "text-slate-200"
              }`}>
                {tech.rsi_14?.toFixed(1) || "—"}
              </div>
            </div>
            <div className="card p-3">
              <div className="text-[10px] text-slate-500 mb-1">ADX</div>
              <div className={`text-base font-mono font-semibold ${tech.adx > 25 ? "text-amber-400" : "text-slate-400"}`}>
                {tech.adx?.toFixed(1) || "—"}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Chart */}
        <div className="col-span-2 space-y-4">
          {/* Chart type selector */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-slate-300">Wykres ceny</div>
              <div className="flex gap-1 bg-slate-800/50 rounded p-0.5">
                {(["price", "rsi", "macd"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setChartType(t)}
                    className={`px-2 py-1 rounded text-xs transition-colors ${chartType === t ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}
                  >
                    {t.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                {chartType === "price" ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#4a5568" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#4a5568" }} domain={["auto", "auto"]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="Cena" />
                    {tech?.sma_20 && (
                      <ReferenceLine y={tech.sma_20} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "SMA20", fill: "#f59e0b", fontSize: 10 }} />
                    )}
                    {tech?.sma_50 && (
                      <ReferenceLine y={tech.sma_50} stroke="#8b5cf6" strokeDasharray="4 4" label={{ value: "SMA50", fill: "#8b5cf6", fontSize: 10 }} />
                    )}
                    {tech?.bb_upper && (
                      <ReferenceLine y={tech.bb_upper} stroke="#ef4444" strokeDasharray="2 4" />
                    )}
                    {tech?.bb_lower && (
                      <ReferenceLine y={tech.bb_lower} stroke="#10b981" strokeDasharray="2 4" />
                    )}
                  </LineChart>
                ) : chartType === "rsi" ? (
                  <LineChart data={[...Array(60)].map((_, i) => ({
                    date: `D-${59-i}`,
                    value: i === 59 ? tech?.rsi_14 : null,
                  })).filter(d => d.value !== null)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#4a5568" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#4a5568" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="4 4" />
                    <ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="RSI" />
                  </LineChart>
                ) : (
                  <LineChart data={[{ date: "Current", macd: tech?.macd_line, signal: tech?.macd_signal }]}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2d45" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#4a5568" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#4a5568" }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="macd" stroke="#3b82f6" strokeWidth={2} name="MACD" />
                    <Line type="monotone" dataKey="signal" stroke="#f59e0b" strokeWidth={2} name="Signal" />
                  </LineChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-slate-600 text-sm">
                Brak danych historycznych. Uruchom analizę.
              </div>
            )}
          </div>

          {/* News */}
          {data.news.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Newsy</h3>
              <div className="space-y-2">
                {data.news.map(article => (
                  <div key={article.id} className="border-b border-slate-800/50 pb-2 last:border-0">
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-200 hover:text-blue-400 transition-colors flex items-start gap-1"
                    >
                      {article.headline}
                      <ExternalLink size={10} className="flex-shrink-0 mt-0.5" />
                    </a>
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      {article.source} • {article.published_at ? new Date(article.published_at).toLocaleDateString("pl-PL") : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Technical Indicators Panel */}
        <div className="space-y-4">
          {/* Overall Signal */}
          {tech && (
            <div className="card p-4 text-center">
              <div className="text-xs text-slate-500 mb-2">Sygnał zbiorczy</div>
              <SignalBadge signal={tech.overall_signal} size="lg" />
              <div className="text-xs text-slate-600 mt-2 font-mono">
                Score: {tech.overall_score.toFixed(2)}
              </div>
              <div className="text-sm font-semibold text-white mt-3">
                AI: {tech.ai_score.toFixed(1)} • {tech.recommendation}
              </div>
              <div className="text-[10px] text-slate-700 mt-1">
                {tech.calculated_at ? new Date(tech.calculated_at).toLocaleString("pl-PL") : ""}
              </div>
            </div>
          )}

          {data.sentiment[0] && (
            <div className="card p-4">
              <div className="text-xs font-medium text-slate-400 mb-3">Wpływ newsów</div>
              <div className={`text-lg font-semibold ${data.sentiment[0].label === "positive" ? "text-emerald-400" : data.sentiment[0].label === "negative" ? "text-red-400" : "text-slate-200"}`}>
                {data.sentiment[0].label.toUpperCase()} {data.sentiment[0].score > 0 ? "+" : ""}{data.sentiment[0].score.toFixed(0)}
              </div>
              <div className="text-xs text-slate-500 mt-2 leading-relaxed">{data.sentiment[0].summary}</div>
            </div>
          )}

          {/* Individual Signals */}
          {tech && (
            <div className="card p-4">
              <div className="text-xs font-medium text-slate-400 mb-3">Wskaźniki techniczne</div>
              <IndividualSignal signal={tech.signal_sma} label="SMA (20/50/200)" />
              <IndividualSignal signal={tech.signal_ema} label="EMA (12/26/50)" />
              <IndividualSignal signal={tech.signal_macd} label="MACD" />
              <IndividualSignal signal={tech.signal_fib} label="Fibonacci" />
              <IndividualSignal signal={tech.signal_stoch} label="Stochastic" />
              <IndividualSignal signal={tech.signal_bb} label="Bollinger Bands" />
              <IndividualSignal signal={tech.signal_rsi} label="RSI (14)" />
              <IndividualSignal signal={tech.signal_adx} label="ADX" />
              <IndividualSignal signal={tech.signal_ichimoku} label="Ichimoku" />
            </div>
          )}

          {/* Key Values */}
          {tech && (
            <div className="card p-4">
              <div className="text-xs font-medium text-slate-400 mb-3">Wartości kluczowe</div>
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">RSI</span>
                  <span className={tech.rsi_14 > 70 ? "text-red-400" : tech.rsi_14 < 30 ? "text-emerald-400" : "text-slate-200"}>
                    {tech.rsi_14?.toFixed(2) || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">MACD line</span>
                  <span className={tech.macd_line > 0 ? "text-emerald-400" : "text-red-400"}>
                    {tech.macd_line?.toFixed(4) || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">MACD hist</span>
                  <span className={tech.macd_histogram > 0 ? "text-emerald-400" : "text-red-400"}>
                    {tech.macd_histogram?.toFixed(4) || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">ADX</span>
                  <span className={tech.adx > 25 ? "text-amber-400" : "text-slate-300"}>
                    {tech.adx?.toFixed(2) || "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Stoch K</span>
                  <span className="text-slate-200">{tech.stoch_k?.toFixed(2) || "—"}</span>
                </div>
                {tech.sma_20 && <div className="flex justify-between"><span className="text-slate-500">SMA 20</span><span className="text-slate-200">${tech.sma_20.toFixed(2)}</span></div>}
                {tech.sma_50 && <div className="flex justify-between"><span className="text-slate-500">SMA 50</span><span className="text-slate-200">${tech.sma_50.toFixed(2)}</span></div>}
                {tech.sma_200 && <div className="flex justify-between"><span className="text-slate-500">SMA 200</span><span className="text-slate-200">${tech.sma_200.toFixed(2)}</span></div>}
                {tech.bb_upper && <div className="flex justify-between"><span className="text-slate-500">BB Upper</span><span className="text-red-400">${tech.bb_upper.toFixed(2)}</span></div>}
                {tech.bb_lower && <div className="flex justify-between"><span className="text-slate-500">BB Lower</span><span className="text-emerald-400">${tech.bb_lower.toFixed(2)}</span></div>}
                {tech.fib_382 && <div className="flex justify-between"><span className="text-slate-500">Fib 38.2%</span><span className="text-slate-200">${tech.fib_382.toFixed(2)}</span></div>}
                {tech.fib_618 && <div className="flex justify-between"><span className="text-slate-500">Fib 61.8%</span><span className="text-slate-200">${tech.fib_618.toFixed(2)}</span></div>}
              </div>
            </div>
          )}

          {/* Portfolio position info */}
          {data.portfolioItem && (
            <div className="card p-4">
              <div className="text-xs font-medium text-slate-400 mb-3">Pozycja w portfolio</div>
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Akcji</span>
                  <span className="text-slate-200">{data.portfolioItem.shares}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cena zakupu</span>
                  <span className="text-slate-200">${data.portfolioItem.purchase_price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Data zakupu</span>
                  <span className="text-slate-200">{data.portfolioItem.purchase_date}</span>
                </div>
              </div>
            </div>
          )}

          {/* Recent Alerts */}
          {data.alerts.length > 0 && (
            <div className="card p-4">
              <div className="text-xs font-medium text-slate-400 mb-3">Ostatnie alerty</div>
              <div className="space-y-2">
                {data.alerts.slice(0, 5).map(alert => (
                  <div key={alert.id} className="text-xs">
                    <span className={`font-medium ${
                      alert.severity === "critical" ? "text-red-400" :
                      alert.severity === "warning" ? "text-amber-400" : "text-blue-400"
                    }`}>[{alert.severity}]</span>
                    <span className="text-slate-400 ml-1">{alert.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.performance.length > 0 && (
            <div className="card p-4">
              <div className="text-xs font-medium text-slate-400 mb-3">Skuteczność rekomendacji</div>
              <div className="space-y-2 text-xs">
                {data.performance.slice(0, 3).map((item) => (
                  <div key={item.id} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">{item.recommendation}</span>
                      <span className={item.accuracy_label === "accurate" ? "text-emerald-400" : item.accuracy_label === "miss" ? "text-red-400" : "text-amber-400"}>{item.accuracy_label}</span>
                    </div>
                    <div className="text-slate-500 mt-1">Success: {item.success_rate.toFixed(1)}% • Avg return: {item.average_return.toFixed(2)}%</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-sm font-medium text-slate-300 mb-3">Historia analiz</div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {data.analysisHistory.length > 0 ? data.analysisHistory.map((entry) => (
              <div key={entry.id} className="rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-white">{entry.recommendation}</span>
                  <span className={entry.score >= 70 ? "text-emerald-400" : entry.score < 40 ? "text-red-400" : "text-slate-300"}>{entry.score.toFixed(1)}</span>
                </div>
                <div className="text-slate-500 mt-1">Cena: ${entry.price.toFixed(2)} • Sentyment: {entry.sentiment.toFixed(0)}</div>
                <div className="text-slate-600 mt-1">{new Date(entry.created_at).toLocaleString("pl-PL")}</div>
              </div>
            )) : <div className="text-sm text-slate-600">Brak zapisanej historii analiz.</div>}
          </div>
        </div>

        <div className="card p-4">
          <div className="text-sm font-medium text-slate-300 mb-3">Ostatni news i sentyment</div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {data.news.length > 0 ? data.news.map((article) => (
              <div key={article.id} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
                <div className="text-xs text-white leading-relaxed">{article.headline}</div>
                <div className="text-[11px] text-slate-500 mt-1">{article.source} • {new Date(article.published_at).toLocaleString("pl-PL")}</div>
              </div>
            )) : <div className="text-sm text-slate-600">Brak newsów dla tego tickera.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
