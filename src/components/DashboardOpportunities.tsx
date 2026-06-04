"use client";

import RecommendationBadge, { recommendationTone } from "@/components/RecommendationBadge";
import PriceChange from "@/components/PriceChange";
import TrendLabel from "@/components/TrendLabel";

export interface RankedOpportunity {
  ticker: string;
  company_name: string;
  price: number;
  market_cap: number | null;
  ai_score: number;
  recommendation: string;
  risk: string;
  reason: string;
  potential?: string;
  change_pct: number;
  rsi_14: number | null;
  overall_signal: string | null;
  sector: string;
  setup_type?: "LONG" | "SHORT" | "WATCH";
  momentum_label?: string;
}

type OpportunityKind = "best" | "worst";

interface DashboardOpportunitiesProps {
  bestOpportunities: RankedOpportunity[];
  worstOpportunities: RankedOpportunity[];
  onOpenScanner: () => void;
  onInspect: (item: RankedOpportunity, kind: OpportunityKind) => void;
  onOpenTicker: (ticker: string) => void;
}

function OpportunityTable({
  title,
  items,
  kind,
  onInspect,
  onOpenTicker,
}: {
  title: string;
  items: RankedOpportunity[];
  kind: OpportunityKind;
  onInspect: (item: RankedOpportunity, kind: OpportunityKind) => void;
  onOpenTicker: (ticker: string) => void;
}) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-medium text-slate-200">{title}</div>
      </div>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-800 bg-slate-950/40 px-3 py-4 text-sm text-slate-500">
          Brak aktywnych sygnałów. Uruchom analizę lub rozszerz watchlistę.
        </div>
      ) : (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2 text-left font-medium">Ticker</th>
              <th className="px-2 py-2 text-right font-medium">AI Score</th>
              <th className="px-2 py-2 text-left font-medium">Setup</th>
              <th className="px-2 py-2 text-right font-medium">{kind === "best" ? "Potencjał" : "Momentum"}</th>
              <th className="px-2 py-2 text-left font-medium">Powód</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.ticker} className="border-b border-slate-800/40 hover:bg-slate-900/60">
                <td className="px-2 py-3">
                  <button onClick={() => onInspect(item, kind)} className="text-left">
                    <div className="font-medium text-white">{item.ticker}</div>
                    <div className="text-[11px] text-slate-500">{item.company_name}</div>
                  </button>
                </td>
                <td className={`px-2 py-3 text-right font-semibold ${kind === "best" ? "text-emerald-400" : "text-red-400"}`}>
                  {item.ai_score.toFixed(0)}
                </td>
                <td className="px-2 py-3">
                  <div className="text-xs font-medium text-white">{item.setup_type || "WATCH"}</div>
                  <RecommendationBadge label={item.recommendation} />
                </td>
                <td className="px-2 py-3 text-right font-mono text-slate-200">
                  {kind === "best" ? item.potential : (
                    <span className="inline-flex flex-col items-end gap-1">
                      <PriceChange value={item.change_pct} className="text-xs" />
                      <TrendLabel delta={item.change_pct} />
                    </span>
                  )}
                  {kind === "best" && <div className="mt-1 text-[11px] text-slate-500">{item.momentum_label}</div>}
                </td>
                <td className="px-2 py-3">
                  <div className="text-[11px] text-slate-300">{item.reason}</div>
                  <div className={`mt-1 font-medium ${recommendationTone(item.recommendation)}`}>{item.recommendation}</div>
                  <div className={`text-[11px] ${item.risk === "Wysokie" ? "text-red-400" : item.risk === "Niskie" ? "text-emerald-400" : "text-amber-400"}`}>{item.risk}</div>
                  <button onClick={() => onOpenTicker(item.ticker)} className="mt-1 text-[11px] text-blue-400 hover:text-blue-300">
                    Otwórz analizę
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}

export default function DashboardOpportunities({
  bestOpportunities,
  worstOpportunities,
  onOpenScanner,
  onInspect,
  onOpenTicker,
}: DashboardOpportunitiesProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <OpportunityTable
        title="Najlepsze okazje"
        items={bestOpportunities}
        kind="best"
        onInspect={onInspect}
        onOpenTicker={onOpenTicker}
      />
      <OpportunityTable
        title="Najgorsze okazje"
        items={worstOpportunities}
        kind="worst"
        onInspect={onInspect}
        onOpenTicker={onOpenTicker}
      />
      <div className="xl:col-span-2 flex justify-end">
        <button onClick={onOpenScanner} className="text-xs text-blue-400 hover:text-blue-300">
          Otwórz skaner →
        </button>
      </div>
    </div>
  );
}
