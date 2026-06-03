"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface Report {
  id: number;
  report_type: string;
  content: string;
  market_sentiment: string;
  created_at: string;
}

const SENTIMENT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  risk_on: { label: "RISK-ON", color: "text-emerald-400", bg: "bg-emerald-900/20 border-emerald-700/50" },
  risk_off: { label: "RISK-OFF", color: "text-red-400", bg: "bg-red-900/20 border-red-700/50" },
  neutral: { label: "NEUTRAL", color: "text-slate-300", bg: "bg-slate-800/50 border-slate-700/50" },
};

export default function Reports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchReports = useCallback(async () => {
    const res = await fetch("/api/reports");
    if (res.ok) setReports(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  // Auto-expand latest
  useEffect(() => {
    if (reports.length > 0 && expanded === null) setExpanded(reports[0].id);
  }, [reports, expanded]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={24} /></div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <FileText size={18} className="text-blue-400" /> Raporty AI
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">{reports.length} raportów</p>
      </div>

      <div className="space-y-2">
        {reports.map((report, idx) => {
          const sentiment = SENTIMENT_CONFIG[report.market_sentiment] || SENTIMENT_CONFIG.neutral;
          const isExpanded = expanded === report.id;
          const isLatest = idx === 0;

          return (
            <div key={report.id} className={`card overflow-hidden ${isLatest ? "border-blue-800/50" : ""}`}>
              <button
                onClick={() => setExpanded(isExpanded ? null : report.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isLatest && (
                    <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-medium">NAJNOWSZY</span>
                  )}
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">
                      {new Date(report.created_at).toLocaleString("pl-PL", {
                        weekday: "short", year: "numeric", month: "short", day: "numeric",
                        hour: "2-digit", minute: "2-digit"
                      })}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {report.report_type === "manual" ? "Ręczna analiza" :
                       report.report_type === "scheduled" ? "Zaplanowana analiza" :
                       report.report_type === "seed" ? "Przykładowy raport" : report.report_type}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] px-2 py-1 rounded border font-medium ${sentiment.bg} ${sentiment.color}`}>
                    {sentiment.label}
                  </span>
                  {isExpanded ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-slate-800">
                  <div className="mt-3 text-sm text-slate-300 whitespace-pre-line leading-relaxed font-mono text-xs bg-slate-900/50 rounded p-4 max-h-96 overflow-y-auto">
                    {report.content}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {reports.length === 0 && (
          <div className="card p-12 text-center text-slate-600">
            <FileText size={32} className="mx-auto mb-2 opacity-30" />
            <div className="text-sm">Brak raportów. Uruchom analizę z dashboardu.</div>
          </div>
        )}
      </div>
    </div>
  );
}
