"use client";

import { Activity } from "lucide-react";
import PriceChange from "@/components/PriceChange";
import TrendLabel from "@/components/TrendLabel";

export interface HeatmapRow {
  ticker: string;
  company_name: string;
  sector: string;
  market_cap: number;
  change_pct: number;
  ai_score: number;
  recommendation: string;
}

interface HeatmapGroup {
  sector: string;
  rows: HeatmapRow[];
}

interface DashboardHeatmapProps {
  groupedHeatmap: HeatmapGroup[];
  onOpenMarket: () => void;
  onOpenTicker: (ticker: string) => void;
}

export default function DashboardHeatmap({ groupedHeatmap, onOpenMarket, onOpenTicker }: DashboardHeatmapProps) {
  const totalTiles = groupedHeatmap.reduce((sum, group) => sum + group.rows.length, 0);

  if (totalTiles === 0) {
    return (
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <Activity size={15} className="text-blue-400" /> Heatmapa sektorowa
          </div>
          <button onClick={onOpenMarket} className="text-xs text-blue-400 hover:text-blue-300">
            Pełny widok →
          </button>
        </div>
        <div className="rounded-md border border-dashed border-slate-800 bg-slate-950/40 px-3 py-4 text-sm text-slate-500">
          Brak aktywnych sygnałów. Uruchom analizę lub rozszerz watchlistę.
        </div>
      </div>
    );
  }

  if (totalTiles <= 2) {
    return (
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <Activity size={15} className="text-blue-400" /> Heatmapa sektorowa
          </div>
          <button onClick={onOpenMarket} className="text-xs text-blue-400 hover:text-blue-300">
            Pełny widok →
          </button>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {groupedHeatmap.flatMap((group) => group.rows.map((tile) => {
            const tone = (tile.ai_score ?? 0) >= 70
              ? "border-emerald-700/40 bg-emerald-500/10"
              : (tile.ai_score ?? 0) <= 35
                ? "border-red-700/40 bg-red-500/10"
                : "border-slate-800 bg-slate-950/50";
            return (
              <button
                key={tile.ticker}
                onClick={() => onOpenTicker(tile.ticker)}
                className={`rounded-md border p-3 text-left transition-colors hover:border-blue-500/40 ${tone}`}
              >
                <div className="text-xs uppercase tracking-wide text-slate-500">{tile.sector}</div>
                <div className="mt-1 text-sm font-semibold text-white">{tile.ticker}</div>
                <div className="mt-1 text-[11px] text-slate-500">{tile.company_name}</div>
                <div className="mt-2 text-xs text-slate-300">AI {tile.ai_score.toFixed(0)} • {tile.recommendation}</div>
              </button>
            );
          }))}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Activity size={15} className="text-blue-400" /> Heatmapa sektorowa
        </div>
        <button onClick={onOpenMarket} className="text-xs text-blue-400 hover:text-blue-300">
          Pełny widok →
        </button>
      </div>
      <div className="space-y-4">
        {groupedHeatmap.map((group) => (
          <div key={group.sector}>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">{group.sector}</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              {group.rows.map((tile) => {
                const tone = tile.ai_score >= 75
                  ? "border-emerald-500/40 bg-emerald-500/18"
                  : tile.ai_score >= 55
                    ? "border-emerald-800/40 bg-emerald-500/8"
                    : tile.ai_score <= 35
                      ? "border-red-500/40 bg-red-500/18"
                      : "border-red-800/40 bg-red-500/8";
                const minHeight = `${Math.max(88, Math.min(150, Math.log10(tile.market_cap) * 13))}px`;
                return (
                  <button
                    key={tile.ticker}
                    onClick={() => onOpenTicker(tile.ticker)}
                    className={`rounded-md border p-3 text-left transition-colors hover:border-blue-500/40 ${tone}`}
                    style={{ minHeight }}
                  >
                    <div className="text-sm font-semibold text-white">{tile.ticker}</div>
                    <div className="mt-0.5 truncate text-[10px] text-slate-500">{tile.company_name}</div>
                    <div className="mt-3 text-xs"><PriceChange value={tile.change_pct} /></div>
                    <div className="mt-1"><TrendLabel delta={tile.change_pct} /></div>
                    <div className="mt-2 text-[10px] text-slate-500">AI {tile.ai_score.toFixed(0)} • {tile.recommendation}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
