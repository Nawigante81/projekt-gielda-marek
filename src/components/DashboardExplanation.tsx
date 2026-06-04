"use client";

import { Sparkles } from "lucide-react";
import RecommendationBadge, { recommendationTone } from "@/components/RecommendationBadge";

export interface DashboardExplanationData {
  ticker: string;
  companyName: string;
  aiScore: number;
  recommendation: string;
  probability: number;
  riskLabel: string;
  reasons: string[];
  marketContext: string[];
}

function riskTone(risk: string): string {
  if (risk === "Niskie") return "text-emerald-400";
  if (risk === "Wysokie") return "text-red-400";
  return "text-amber-400";
}

interface DashboardExplanationProps {
  explanation: DashboardExplanationData | null;
  onOpenTicker: (ticker: string) => void;
}

export default function DashboardExplanation({ explanation, onOpenTicker }: DashboardExplanationProps) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-200">
        <Sparkles size={15} className="text-blue-400" /> Dlaczego AI to rekomenduje?
      </div>
      {explanation ? (
        <div className="space-y-3">
          <div className="rounded-md border border-slate-800 bg-slate-950/50 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">{explanation.ticker}</div>
                <div className="text-[11px] text-slate-500">{explanation.companyName}</div>
              </div>
              <button onClick={() => onOpenTicker(explanation.ticker)} className="text-xs text-blue-400 hover:text-blue-300">
                Otwórz spółkę →
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-slate-900/70 p-2">
                <div className="text-slate-500">AI Score</div>
                <div className={`mt-1 text-lg font-semibold ${recommendationTone(explanation.recommendation)}`}>{explanation.aiScore}</div>
              </div>
              <div className="rounded-md bg-slate-900/70 p-2">
                <div className="text-slate-500">Prawd. sukcesu</div>
                <div className="mt-1 text-lg font-semibold text-white">{explanation.probability}%</div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <RecommendationBadge label={explanation.recommendation} />
              <span className={`text-xs ${riskTone(explanation.riskLabel)}`}>Ryzyko: {explanation.riskLabel}</span>
            </div>
          </div>

          <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">Powody</div>
            <div className="space-y-2">
              {explanation.reasons.length > 0 ? explanation.reasons.map((reason) => (
                <div key={reason} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="mt-0.5 text-emerald-400">✓</span>
                  <span>{reason}</span>
                </div>
              )) : (
                <div className="text-sm text-slate-600">AI nie ma jeszcze wystarczająco bogatego kontekstu dla tej pozycji.</div>
              )}
            </div>
          </div>

          <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-slate-500">Kontekst</div>
            <div className="space-y-2">
              {explanation.marketContext.length > 0 ? explanation.marketContext.map((item) => (
                <div key={item} className="text-sm text-slate-400">{item}</div>
              )) : (
                <div className="text-sm text-slate-600">Brak dodatkowego kontekstu SEC / earnings / alertów.</div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-sm text-slate-600">Kliknij rekomendację z portfolio lub okazji, aby zobaczyć wyjaśnienie AI.</div>
      )}
    </div>
  );
}
