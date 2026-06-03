"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Activity, Loader2 } from "lucide-react";
import SignalBadge, { IndividualSignal } from "@/components/SignalBadge";

interface TechData {
  ticker: string;
  company_name?: string;
  overall_signal: string;
  overall_score: number;
  rsi_14: number | null;
  macd_line: number | null;
  macd_histogram: number | null;
  adx: number | null;
  sma_20: number | null;
  sma_50: number | null;
  bb_upper: number | null;
  bb_lower: number | null;
  stoch_k: number | null;
  signal_sma: string;
  signal_ema: string;
  signal_macd: string;
  signal_rsi: string;
  signal_bb: string;
  signal_stoch: string;
  signal_adx: string;
  signal_ichimoku: string;
  signal_fib: string;
  current_price: number | null;
  calculated_at: string;
}

interface CombinedItem {
  ticker: string;
  company_name: string;
  type: "portfolio" | "watchlist";
  tech: TechData | null;
  price: number | null;
}

export default function Technicals() {
  const { setSelectedTicker, setActiveView } = useAppStore();
  const [items, setItems] = useState<CombinedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "bullish" | "bearish" | "neutral">("all");

  const fetchData = useCallback(async () => {
    const [portRes, watchRes] = await Promise.all([
      fetch("/api/portfolio"),
      fetch("/api/watchlist"),
    ]);

    const portfolio = portRes.ok ? await portRes.json() : [];
    const watchlist = watchRes.ok ? await watchRes.json() : [];

    const combined: CombinedItem[] = [
      ...portfolio.map((p: { ticker: string; company_name: string; current_price: number | null; overall_signal: string | null; rsi_14: number | null; macd_histogram: number | null; signal_sma?: string; signal_ema?: string; signal_macd?: string; signal_rsi?: string; signal_bb?: string; signal_stoch?: string; signal_adx?: string; signal_ichimoku?: string; signal_fib?: string; adx?: number; sma_20?: number; sma_50?: number; bb_upper?: number; bb_lower?: number; stoch_k?: number; macd_line?: number; overall_score?: number; calculated_at?: string; }) => ({
        ticker: p.ticker,
        company_name: p.company_name || p.ticker,
        type: "portfolio" as const,
        tech: p.overall_signal ? {
          ticker: p.ticker,
          overall_signal: p.overall_signal,
          overall_score: p.overall_score || 0,
          rsi_14: p.rsi_14,
          macd_line: p.macd_line || null,
          macd_histogram: p.macd_histogram,
          adx: p.adx || null,
          sma_20: p.sma_20 || null,
          sma_50: p.sma_50 || null,
          bb_upper: p.bb_upper || null,
          bb_lower: p.bb_lower || null,
          stoch_k: p.stoch_k || null,
          signal_sma: p.signal_sma || "no_data",
          signal_ema: p.signal_ema || "no_data",
          signal_macd: p.signal_macd || "no_data",
          signal_rsi: p.signal_rsi || "no_data",
          signal_bb: p.signal_bb || "no_data",
          signal_stoch: p.signal_stoch || "no_data",
          signal_adx: p.signal_adx || "no_data",
          signal_ichimoku: p.signal_ichimoku || "no_data",
          signal_fib: p.signal_fib || "no_data",
          current_price: p.current_price,
          calculated_at: p.calculated_at || "",
        } : null,
        price: p.current_price,
      })),
      ...watchlist.map((w: { ticker: string; company_name: string; current_price: number | null; overall_signal: string | null; rsi_14: number | null; signal_macd?: string; macd_histogram?: number; signal_sma?: string; signal_ema?: string; signal_rsi?: string; signal_bb?: string; signal_stoch?: string; signal_adx?: string; signal_ichimoku?: string; signal_fib?: string; adx?: number; sma_20?: number; sma_50?: number; bb_upper?: number; bb_lower?: number; stoch_k?: number; macd_line?: number; overall_score?: number; calculated_at?: string; }) => ({
        ticker: w.ticker,
        company_name: w.company_name || w.ticker,
        type: "watchlist" as const,
        tech: w.overall_signal ? {
          ticker: w.ticker,
          overall_signal: w.overall_signal,
          overall_score: w.overall_score || 0,
          rsi_14: w.rsi_14,
          macd_line: w.macd_line || null,
          macd_histogram: w.macd_histogram || null,
          adx: w.adx || null,
          sma_20: w.sma_20 || null,
          sma_50: w.sma_50 || null,
          bb_upper: w.bb_upper || null,
          bb_lower: w.bb_lower || null,
          stoch_k: w.stoch_k || null,
          signal_sma: w.signal_sma || "no_data",
          signal_ema: w.signal_ema || "no_data",
          signal_macd: w.signal_macd || "no_data",
          signal_rsi: w.signal_rsi || "no_data",
          signal_bb: w.signal_bb || "no_data",
          signal_stoch: w.signal_stoch || "no_data",
          signal_adx: w.signal_adx || "no_data",
          signal_ichimoku: w.signal_ichimoku || "no_data",
          signal_fib: w.signal_fib || "no_data",
          current_price: w.current_price,
          calculated_at: w.calculated_at || "",
        } : null,
        price: w.current_price,
      })),
    ];

    setItems(combined);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredItems = items.filter(item => {
    if (filter === "all") return true;
    const sig = item.tech?.overall_signal || "neutral";
    if (filter === "bullish") return sig.includes("bullish");
    if (filter === "bearish") return sig.includes("bearish");
    return sig === "neutral" || sig === "watch";
  });

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={24} /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <Activity size={18} className="text-blue-400" /> Sygnały techniczne
        </h1>
        <div className="flex items-center gap-1 bg-slate-800/50 rounded-md p-0.5">
          {(["all", "bullish", "bearish", "neutral"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-xs transition-colors ${filter === f ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}
            >
              {f === "all" ? "Wszystkie" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Ticker</th>
              <th className="text-center px-2 py-3 text-xs text-slate-500 font-medium">Ogólny</th>
              <th className="text-center px-2 py-3 text-xs text-slate-500 font-medium">SMA</th>
              <th className="text-center px-2 py-3 text-xs text-slate-500 font-medium">EMA</th>
              <th className="text-center px-2 py-3 text-xs text-slate-500 font-medium">MACD</th>
              <th className="text-center px-2 py-3 text-xs text-slate-500 font-medium">RSI</th>
              <th className="text-center px-2 py-3 text-xs text-slate-500 font-medium">BB</th>
              <th className="text-center px-2 py-3 text-xs text-slate-500 font-medium">Stoch</th>
              <th className="text-center px-2 py-3 text-xs text-slate-500 font-medium">ADX</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">RSI val</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">ADX val</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => {
              const t = item.tech;
              const isExpanded = expanded === item.ticker;

              const signalDot = (signal: string) => {
                const colors: Record<string, string> = {
                  bullish: "bg-emerald-500",
                  bearish: "bg-red-500",
                  neutral: "bg-slate-600",
                  no_data: "bg-slate-800",
                };
                return <span className={`inline-block w-2 h-2 rounded-full ${colors[signal] || colors.neutral}`} title={signal} />;
              };

              return (
                <Fragment key={item.ticker}>
                  <tr
                    className="border-b border-slate-800/50 hover:bg-slate-800/20 cursor-pointer transition-colors"
                    onClick={() => setExpanded(isExpanded ? null : item.ticker)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedTicker(item.ticker); setActiveView("ticker"); }}
                          className="text-sm font-semibold text-white hover:text-blue-400 transition-colors"
                        >
                          {item.ticker}
                        </button>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.type === "portfolio" ? "bg-blue-900/40 text-blue-400" : "bg-slate-800 text-slate-500"}`}>
                          {item.type === "portfolio" ? "port" : "watch"}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-600">{item.company_name}</div>
                    </td>
                    <td className="px-2 py-3 text-center">
                      {t ? <SignalBadge signal={t.overall_signal} /> : <span className="text-slate-700 text-xs">brak danych</span>}
                    </td>
                    {["signal_sma", "signal_ema", "signal_macd", "signal_rsi", "signal_bb", "signal_stoch", "signal_adx"].map(field => (
                      <td key={field} className="px-2 py-3 text-center">
                        {t ? signalDot((t as unknown as Record<string, string>)[field] || "no_data") : <span className="text-slate-800">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {t?.rsi_14 ? (
                        <span className={t.rsi_14 > 70 ? "text-red-400" : t.rsi_14 < 30 ? "text-emerald-400" : "text-slate-300"}>
                          {t.rsi_14.toFixed(1)}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {t?.adx ? (
                        <span className={t.adx > 25 ? "text-amber-400" : "text-slate-400"}>
                          {t.adx.toFixed(1)}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                  {isExpanded && t && (
                    <tr className="border-b border-slate-800/50 bg-slate-900/50">
                      <td colSpan={11} className="px-4 py-3">
                        <div className="grid grid-cols-3 gap-4 text-xs">
                          <div>
                            <div className="text-slate-500 font-medium mb-2">Wskaźniki cenowe</div>
                            <IndividualSignal signal={t.signal_sma} label="SMA (20/50/200)" />
                            <IndividualSignal signal={t.signal_ema} label="EMA (12/26/50)" />
                            <IndividualSignal signal={t.signal_bb} label="Bollinger Bands" />
                            <IndividualSignal signal={t.signal_fib} label="Fibonacci" />
                          </div>
                          <div>
                            <div className="text-slate-500 font-medium mb-2">Momentum / Trend</div>
                            <IndividualSignal signal={t.signal_macd} label="MACD" />
                            <IndividualSignal signal={t.signal_rsi} label="RSI (14)" />
                            <IndividualSignal signal={t.signal_stoch} label="Stochastic" />
                            <IndividualSignal signal={t.signal_adx} label="ADX" />
                          </div>
                          <div>
                            <div className="text-slate-500 font-medium mb-2">Wartości</div>
                            <div className="space-y-1 font-mono text-slate-400">
                              {t.rsi_14 && <div>RSI: <span className={t.rsi_14 > 70 ? "text-red-400" : t.rsi_14 < 30 ? "text-emerald-400" : "text-slate-200"}>{t.rsi_14.toFixed(2)}</span></div>}
                              {t.macd_histogram && <div>MACD hist: <span className={t.macd_histogram > 0 ? "text-emerald-400" : "text-red-400"}>{t.macd_histogram.toFixed(4)}</span></div>}
                              {t.adx && <div>ADX: <span className={t.adx > 25 ? "text-amber-400" : "text-slate-300"}>{t.adx.toFixed(2)}</span></div>}
                              {t.stoch_k && <div>Stoch K: <span className="text-slate-200">{t.stoch_k.toFixed(2)}</span></div>}
                              {t.sma_20 && <div>SMA20: <span className="text-slate-200">${t.sma_20.toFixed(2)}</span></div>}
                              {t.sma_50 && <div>SMA50: <span className="text-slate-200">${t.sma_50.toFixed(2)}</span></div>}
                            </div>
                            <IndividualSignal signal={t.signal_ichimoku} label="Ichimoku" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-slate-600">
                  <Activity size={32} className="mx-auto mb-2 opacity-30" />
                  <div className="text-sm">Brak danych technicznych. Uruchom analizę.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-600 text-center">
        Kliknij wiersz, aby rozwinąć szczegóły • ▲ bullish • ▼ bearish • ● neutral • — brak danych
      </div>
    </div>
  );
}
