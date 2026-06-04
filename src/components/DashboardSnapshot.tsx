"use client";

import { FileSearch } from "lucide-react";

export interface DashboardSecFiling {
  id: number;
  ticker: string;
  form: string;
  filing_date: string;
}

interface DashboardSnapshotProps {
  secFilings: DashboardSecFiling[];
  onOpenSec: () => void;
  onOpenEarnings: () => void;
  onOpenTicker: (ticker: string) => void;
}

export default function DashboardSnapshot({ secFilings, onOpenSec, onOpenEarnings, onOpenTicker }: DashboardSnapshotProps) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <FileSearch size={15} className="text-blue-400" /> SEC / earnings snapshot
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onOpenSec} className="text-xs text-blue-400 hover:text-blue-300">
            SEC →
          </button>
          <button onClick={onOpenEarnings} className="text-xs text-blue-400 hover:text-blue-300">
            Earnings →
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {secFilings.slice(0, 4).map((filing) => (
          <button
            key={filing.id}
            onClick={() => onOpenTicker(filing.ticker)}
            className="w-full rounded-md border border-slate-800 bg-slate-900/60 p-3 text-left transition-colors hover:border-blue-500/40"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm text-white">{filing.ticker} • {filing.form}</div>
                <div className="mt-1 text-[11px] text-slate-500">{new Date(filing.filing_date).toLocaleDateString("pl-PL")}</div>
              </div>
              <span className="rounded border border-fuchsia-500/30 bg-fuchsia-500/10 px-2 py-0.5 text-[10px] text-fuchsia-300">
                SEC
              </span>
            </div>
          </button>
        ))}
        {secFilings.length === 0 && (
          <div className="text-sm text-slate-600">Brak filingów SEC w cache dashboardu.</div>
        )}
      </div>
    </div>
  );
}
