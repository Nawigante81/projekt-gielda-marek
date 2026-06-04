"use client";

import { FileText } from "lucide-react";

interface PerformanceSummary {
  total: number;
  successRate: number;
  averageReturn: number;
  accurateCount: number;
  missCount: number;
}

interface PerformanceItem {
  ticker: string;
  average_return: number | null;
  recommendation: string | null;
}

interface DashboardPerformanceProps {
  performance: {
    summary: PerformanceSummary | null;
    topHits: PerformanceItem[];
    topMisses: PerformanceItem[];
  } | null;
}

export default function DashboardPerformance({ performance }: DashboardPerformanceProps) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <FileText size={15} className="text-blue-400" /> Skuteczność AI
        </div>
      </div>
      {performance?.summary && performance.summary.total > 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-slate-950/50 p-3">
              <div className="text-[11px] text-slate-500">Skuteczność</div>
              <div className="mt-1 text-xl font-semibold text-white">{performance.summary.successRate.toFixed(1)}%</div>
            </div>
            <div className="rounded-md bg-slate-950/50 p-3">
              <div className="text-[11px] text-slate-500">Średni zwrot</div>
              <div className={`mt-1 text-xl font-semibold ${performance.summary.averageReturn >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                {performance.summary.averageReturn.toFixed(2)}%
              </div>
            </div>
            <div className="rounded-md bg-slate-950/50 p-3">
              <div className="text-[11px] text-slate-500">Zamknięte analizy</div>
              <div className="mt-1 text-lg font-semibold text-white">{performance.summary.total}</div>
            </div>
            <div className="rounded-md bg-slate-950/50 p-3">
              <div className="text-[11px] text-slate-500">Bilans trafień</div>
              <div className="mt-1 text-lg font-semibold text-white">{performance.summary.accurateCount}/{performance.summary.missCount}</div>
            </div>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Najlepsza rekomendacja</div>
              {performance.topHits[0] ? (
                <div className="mt-2 text-sm text-slate-300">
                  {performance.topHits[0].ticker} • {performance.topHits[0].average_return?.toFixed(2)}% • {performance.topHits[0].recommendation || "N/A"}
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-600">Brak danych.</div>
              )}
            </div>
            <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Najsłabsza rekomendacja</div>
              {performance.topMisses[0] ? (
                <div className="mt-2 text-sm text-slate-300">
                  {performance.topMisses[0].ticker} • {performance.topMisses[0].average_return?.toFixed(2)}% • {performance.topMisses[0].recommendation || "N/A"}
                </div>
              ) : (
                <div className="mt-2 text-sm text-slate-600">Brak danych.</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-500">
          Brak wystarczających danych do oceny skuteczności AI.
        </div>
      )}
    </div>
  );
}
