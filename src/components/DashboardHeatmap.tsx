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
                const tone = tile.change_pct >= 2
                  ? "border-emerald-500/40 bg-emerald-500/18"
                  : tile.change_pct > 0
                    ? "border-emerald-800/40 bg-emerald-500/8"
                    : tile.change_pct <= -2
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
