"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { BarChart2, TrendingUp, TrendingDown, Minus, Loader2 } from "lucide-react";
import PriceChange from "@/components/PriceChange";

interface MarketIndex {
  id: number;
  symbol: string;
  name: string;
  value: number | null;
  change_pct: number | null;
  change_abs: number | null;
  trend: string;
  market_status: string;
  last_updated: string;
}

interface HeatmapTile {
  ticker: string;
  company_name: string;
  sector: string;
  market_cap: number;
  price: number | null;
  change_pct: number;
  ai_score: number;
  recommendation: string;
}

interface SectorRow {
  sector: string;
  avg_change_pct: number;
  sentiment_score: number;
  sentiment_label: string;
  best_ticker: string | null;
  best_change_pct: number | null;
  worst_ticker: string | null;
  worst_change_pct: number | null;
}

interface MarketEvent {
  id: number;
  event_type: string;
  title: string;
  ticker: string | null;
  event_date: string;
  impact: string;
}

const INDEX_META: Record<string, { icon: string; category: string; description: string }> = {
  "SPY": { icon: "📈", category: "Equities", description: "S&P 500 ETF - 500 największych spółek USA" },
  "QQQ": { icon: "💻", category: "Equities", description: "Nasdaq 100 ETF - spółki technologiczne" },
  "DIA": { icon: "🏛️", category: "Equities", description: "Dow Jones ETF - 30 blue chips USA" },
  "IWM": { icon: "🏢", category: "Equities", description: "Russell 2000 ETF - małe spółki USA" },
  "^VIX": { icon: "⚡", category: "Volatility", description: "Indeks strachu - zmienność S&P 500" },
  "DX-Y.NYB": { icon: "💵", category: "Currencies", description: "Indeks siły dolara" },
  "^TNX": { icon: "🏦", category: "Bonds", description: "Rentowność 10-letnich obligacji USA" },
  "GC=F": { icon: "🥇", category: "Commodities", description: "Złoto - kontrakt terminowy" },
  "CL=F": { icon: "🛢️", category: "Commodities", description: "Ropa WTI - kontrakt terminowy" },
  "BTC-USD": { icon: "₿", category: "Crypto", description: "Bitcoin USD" },
  "ETH-USD": { icon: "⟠", category: "Crypto", description: "Ethereum USD" },
};

const CATEGORIES = ["Equities", "Volatility", "Bonds", "Currencies", "Commodities", "Crypto"];

function MarketStatus({ value, change_pct, symbol }: { value: number | null; change_pct: number | null; symbol: string }) {
  if (symbol === "^VIX" && value) {
    if (value > 30) return <span className="text-xs text-red-400 font-medium">⚠ High Fear</span>;
    if (value > 20) return <span className="text-xs text-amber-400 font-medium">⚠ Elevated</span>;
    return <span className="text-xs text-emerald-400 font-medium">✓ Low</span>;
  }

  if (change_pct !== null) {
    if (change_pct > 1) return <span className="text-xs text-emerald-400 font-medium">↑ Risk-On</span>;
    if (change_pct < -1) return <span className="text-xs text-red-400 font-medium">↓ Risk-Off</span>;
    return <span className="text-xs text-slate-400 font-medium">— Neutral</span>;
  }
  return <span className="text-xs text-slate-600">—</span>;
}

export default function Market() {
  const { setSelectedTicker, setActiveView } = useAppStore();
  const [indices, setIndices] = useState<MarketIndex[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapTile[]>([]);
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [events, setEvents] = useState<{ today: MarketEvent[]; tomorrow: MarketEvent[]; thisWeek: MarketEvent[]; next30Days: MarketEvent[] } | null>(null);
  const [heatmapIndex, setHeatmapIndex] = useState<"SP500" | "NASDAQ" | "DOW">("SP500");
  const [loading, setLoading] = useState(true);

  const fetchMarket = useCallback(async () => {
    const [marketRes, heatmapRes, sectorsRes, eventsRes] = await Promise.all([
      fetch("/api/market"),
      fetch(`/api/heatmap?index=${heatmapIndex}`),
      fetch("/api/sectors"),
      fetch("/api/market-events"),
    ]);
    if (marketRes.ok) setIndices(await marketRes.json());
    if (heatmapRes.ok) {
      const data = await heatmapRes.json();
      setHeatmap(data.tiles || []);
    }
    if (sectorsRes.ok) setSectors(await sectorsRes.json());
    if (eventsRes.ok) {
      const data = await eventsRes.json();
      setEvents(data.buckets || null);
    }
    setLoading(false);
  }, [heatmapIndex]);

  useEffect(() => { fetchMarket(); }, [fetchMarket]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={24} /></div>;
  }

  const indexBySymbol = Object.fromEntries(indices.map(i => [i.symbol, i]));
  const spy = indexBySymbol["SPY"];
  const vix = indexBySymbol["^VIX"];

  // Overall market sentiment
  const spyChange = spy?.change_pct || 0;
  const vixVal = vix?.value || 20;
  let sentiment = "NEUTRAL";
  let sentimentColor = "text-slate-300";
  let sentimentBg = "border-slate-700/50";
  if (spyChange > 0.5 && vixVal < 20) { sentiment = "RISK-ON"; sentimentColor = "text-emerald-400"; sentimentBg = "border-emerald-700/50 bg-emerald-900/10"; }
  else if (spyChange < -0.5 || vixVal > 25) { sentiment = "RISK-OFF"; sentimentColor = "text-red-400"; sentimentBg = "border-red-700/50 bg-red-900/10"; }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <BarChart2 size={18} className="text-blue-400" /> Rynek USA / Wall Street
        </h1>
        <div className="text-xs text-slate-500">
          Dane z darmowych API
        </div>
      </div>

      {/* Sentiment Banner */}
      <div className={`card p-4 border ${sentimentBg}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 mb-1">Sentyment rynku</div>
            <div className={`text-2xl font-bold font-mono ${sentimentColor}`}>{sentiment}</div>
          </div>
          <div className="grid grid-cols-3 gap-6 text-right">
            <div>
              <div className="text-xs text-slate-500">S&P 500</div>
              <div className="font-mono text-sm text-white">{spy?.value ? `$${spy.value.toFixed(2)}` : "—"}</div>
              <PriceChange value={spy?.change_pct ?? null} className="text-xs" />
            </div>
            <div>
              <div className="text-xs text-slate-500">VIX</div>
              <div className={`font-mono text-sm ${vixVal > 25 ? "text-red-400" : vixVal < 15 ? "text-emerald-400" : "text-white"}`}>
                {vix?.value ? vix.value.toFixed(2) : "—"}
              </div>
              <PriceChange value={vix?.change_pct ?? null} className="text-xs" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Nasdaq 100</div>
              <div className="font-mono text-sm text-white">{indexBySymbol["QQQ"]?.value ? `$${indexBySymbol["QQQ"].value.toFixed(2)}` : "—"}</div>
              <PriceChange value={indexBySymbol["QQQ"]?.change_pct ?? null} className="text-xs" />
            </div>
          </div>
        </div>
      </div>

      {/* Indices by category */}
      {CATEGORIES.map(category => {
        const categoryIndices = indices.filter(idx => {
          const meta = INDEX_META[idx.symbol];
          return meta && meta.category === category;
        });
        if (categoryIndices.length === 0) return null;

        return (
          <div key={category}>
            <h2 className="text-sm font-medium text-slate-400 mb-2">{category}</h2>
            <div className="grid grid-cols-2 gap-3">
              {categoryIndices.map(idx => {
                const meta = INDEX_META[idx.symbol] || { icon: "📊", description: idx.name };
                const trendIcon = idx.change_pct && idx.change_pct > 0
                  ? <TrendingUp size={12} className="text-emerald-400" />
                  : idx.change_pct && idx.change_pct < 0
                  ? <TrendingDown size={12} className="text-red-400" />
                  : <Minus size={12} className="text-slate-500" />;

                return (
                  <div key={idx.symbol} className="card p-4 card-hover">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-lg">{meta.icon}</span>
                          <div>
                            <div className="text-sm font-medium text-white">{idx.name}</div>
                            <div className="text-[10px] text-slate-600">{idx.symbol}</div>
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-500">{meta.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-base font-semibold text-white">
                          {idx.value
                            ? (idx.symbol.includes("TNX") ? idx.value.toFixed(3) + "%" : `$${idx.value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`)
                            : "—"
                          }
                        </div>
                        <div className="flex items-center gap-1 justify-end mt-0.5">
                          {trendIcon}
                          <PriceChange value={idx.change_pct ?? null} className="text-xs" />
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-slate-800 pt-2">
                      <div className="text-[10px] text-slate-600">
                        {idx.last_updated ? `${new Date(idx.last_updated).toLocaleTimeString("pl-PL")}` : "—"}
                      </div>
                      <MarketStatus value={idx.value} change_pct={idx.change_pct} symbol={idx.symbol} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-400">Heatmapa rynku</h2>
          <div className="flex items-center gap-1 bg-slate-800/50 rounded-md p-0.5">
            {(["SP500", "NASDAQ", "DOW"] as const).map((index) => (
              <button
                key={index}
                onClick={() => setHeatmapIndex(index)}
                className={`px-3 py-1 rounded text-xs transition-colors ${heatmapIndex === index ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                {index}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-6 gap-2">
          {heatmap.slice(0, 24).map((tile) => {
            const bg = tile.change_pct >= 2 ? "bg-emerald-500/25 border-emerald-700/40" :
              tile.change_pct > 0 ? "bg-emerald-500/10 border-emerald-800/30" :
              tile.change_pct <= -2 ? "bg-red-500/25 border-red-700/40" :
              tile.change_pct < 0 ? "bg-red-500/10 border-red-800/30" :
              "bg-slate-900/60 border-slate-800";
            return (
              <button
                key={tile.ticker}
                onClick={() => { setSelectedTicker(tile.ticker); setActiveView("ticker"); }}
                className={`rounded-md border p-3 text-left transition-colors hover:border-blue-500/40 ${bg}`}
                style={{ minHeight: `${Math.max(90, Math.min(160, Math.log10(tile.market_cap) * 12))}px` }}
              >
                <div className="text-sm font-semibold text-white">{tile.ticker}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 truncate">{tile.company_name}</div>
                <div className="text-xs mt-3"><PriceChange value={tile.change_pct} /></div>
                <div className="text-[10px] text-slate-500 mt-2">AI {tile.ai_score.toFixed(0)} • {tile.recommendation}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-sm font-medium text-slate-300 mb-3">Analiza sektorów</div>
          <div className="space-y-2">
            {sectors.map((sector) => (
              <div key={sector.sector} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-white">{sector.sector}</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Best: {sector.best_ticker || "—"} ({sector.best_change_pct?.toFixed(2) || "0.00"}%) • Worst: {sector.worst_ticker || "—"} ({sector.worst_change_pct?.toFixed(2) || "0.00"}%)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={sector.avg_change_pct >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
                      {sector.avg_change_pct >= 0 ? "+" : ""}{sector.avg_change_pct.toFixed(2)}%
                    </div>
                    <div className={`text-[10px] ${sector.sentiment_label === "positive" ? "text-emerald-400" : sector.sentiment_label === "negative" ? "text-red-400" : "text-slate-500"}`}>
                      sentiment {sector.sentiment_score.toFixed(0)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="text-sm font-medium text-slate-300 mb-3">Kalendarz rynku</div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { label: "Dzisiaj", rows: events?.today || [] },
              { label: "Jutro", rows: events?.tomorrow || [] },
              { label: "Ten tydzień", rows: events?.thisWeek || [] },
              { label: "30 dni", rows: events?.next30Days || [] },
            ].map((bucket) => (
              <div key={bucket.label} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
                <div className="text-slate-400 mb-2">{bucket.label}</div>
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {bucket.rows.length > 0 ? bucket.rows.slice(0, 10).map((event) => (
                    <div key={`${bucket.label}-${event.id || event.title}`}>
                      <div className="text-white">{event.ticker ? `${event.ticker} • ` : ""}{event.title}</div>
                      <div className="text-slate-500 mt-0.5">{event.event_type} • {new Date(event.event_date).toLocaleString("pl-PL")}</div>
                    </div>
                  )) : <div className="text-slate-600">Brak wydarzeń</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {indices.length === 0 && (
        <div className="card p-12 text-center text-slate-600">
          <BarChart2 size={32} className="mx-auto mb-2 opacity-30" />
          <div className="text-sm">Brak danych rynkowych. Uruchom analizę, aby pobrać dane.</div>
        </div>
      )}
    </div>
  );
}
