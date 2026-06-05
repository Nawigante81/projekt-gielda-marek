"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Search, RefreshCw, Loader2, AlertTriangle, Zap, Eye } from "lucide-react";
import SignalBadge from "@/components/SignalBadge";
import PriceChange from "@/components/PriceChange";
import toast from "react-hot-toast";

type OpportunityType = "observed" | "opportunity" | "high_volume" | "after_earnings" | "unusual_move";

interface ScanResult {
  ticker: string;
  company_name: string | null;
  price: number;
  change_pct: number;
  reasons: string[];
  confirming_indicators: string[];
  risk_level: string;
  status: string;
  opportunity_type: OpportunityType;
  is_watchlisted: boolean;
  rsi: number | null;
  overall_signal: string | null;
  scanner_types: string[];
}

const STATUS_CONFIG = {
  mocny_sygnal: { label: "Mocny sygnał", icon: <Zap size={12} />, color: "text-emerald-400", bg: "bg-emerald-900/30 border-emerald-700/50" },
  obserwuj: { label: "Obserwuj", icon: <Eye size={12} />, color: "text-blue-400", bg: "bg-blue-900/20 border-blue-700/50" },
  wysokie_ryzyko: { label: "Wysokie ryzyko", icon: <AlertTriangle size={12} />, color: "text-red-400", bg: "bg-red-900/20 border-red-700/50" },
};

const RISK_CONFIG = {
  low: { label: "Niskie", color: "text-emerald-400" },
  medium: { label: "Średnie", color: "text-amber-400" },
  high: { label: "Wysokie", color: "text-red-400" },
};

const OPPORTUNITY_CONFIG: Record<OpportunityType, { label: string; style: string }> = {
  observed: { label: "Obserwowane", style: "border-slate-700 bg-slate-900/70 text-slate-300" },
  opportunity: { label: "Potencjalna okazja", style: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  high_volume: { label: "Wysoki wolumen", style: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  after_earnings: { label: "Po wynikach", style: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
  unusual_move: { label: "Nietypowy ruch", style: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300" },
};

const SCANNER_TYPE_CONFIG: Record<string, { label: string; style: string }> = {
  breakout: { label: "Breakout", style: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
  momentum: { label: "Momentum", style: "border-blue-500/30 bg-blue-500/10 text-blue-300" },
  unusual_volume: { label: "Unusual Volume", style: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
  gap: { label: "Gap", style: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300" },
  earnings: { label: "Earnings", style: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300" },
  general: { label: "General", style: "border-slate-700 bg-slate-900 text-slate-300" },
};

export default function Scanner() {
  const { setSelectedTicker, setActiveView } = useAppStore();
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | "mocny_sygnal" | "obserwuj" | "wysokie_ryzyko">("all");
  const [scannerType, setScannerType] = useState<string>("all");
  const [savingTicker, setSavingTicker] = useState<string | null>(null);

  const fetchScanner = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/scanner");
    if (res.ok) setResults(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchScanner(); }, [fetchScanner]);

  const filtered = results.filter(r => {
    const statusMatch = filterStatus === "all" || r.status === filterStatus;
    const typeMatch = scannerType === "all" || (r.scanner_types || []).includes(scannerType);
    return statusMatch && typeMatch;
  });

  const saveToWatchlist = async (ticker: string) => {
    setSavingTicker(ticker);
    try {
      const res = await fetch("/api/scanner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Nie udało się zapisać do watchlisty");
        return;
      }
      toast.success(`${ticker} zapisany w watchliście`);
      await fetchScanner();
    } finally {
      setSavingTicker(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Search size={18} className="text-blue-400" /> Skaner okazji
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {results.length} sygnałów wykrytych • Portfolio + Watchlista
          </p>
        </div>
        <button
          onClick={fetchScanner}
          className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 text-sm rounded-md transition-colors"
        >
          <RefreshCw size={14} /> Odśwież
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1 bg-slate-800/50 rounded-md p-0.5 w-fit">
        <button
          onClick={() => setFilterStatus("all")}
          className={`px-3 py-1 rounded text-xs transition-colors ${filterStatus === "all" ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}
        >
          Wszystkie ({results.length})
        </button>
        {(["mocny_sygnal", "obserwuj", "wysokie_ryzyko"] as const).map(status => {
          const cfg = STATUS_CONFIG[status];
          const count = results.filter(r => r.status === status).length;
          return (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1 rounded text-xs transition-colors flex items-center gap-1 ${filterStatus === status ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}
            >
              <span className={filterStatus === status ? "text-white" : cfg.color}>{cfg.icon}</span>
              {cfg.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1 bg-slate-800/50 rounded-md p-0.5 w-fit">
        {(["all", "breakout", "momentum", "unusual_volume", "gap", "earnings"] as const).map(type => {
          const count = type === "all" ? results.length : results.filter(result => (result.scanner_types || []).includes(type)).length;
          return (
            <button
              key={type}
              onClick={() => setScannerType(type)}
              className={`px-3 py-1 rounded text-xs transition-colors ${scannerType === type ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}
            >
              {type === "all" ? "Wszystkie typy" : SCANNER_TYPE_CONFIG[type].label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-blue-500" size={24} /></div>
      ) : (
        <div className="space-y-3">
          {filtered.map((result) => {
            const statusCfg = STATUS_CONFIG[result.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.obserwuj;
            const riskCfg = RISK_CONFIG[result.risk_level as keyof typeof RISK_CONFIG] || RISK_CONFIG.medium;
            const opportunityCfg = OPPORTUNITY_CONFIG[result.opportunity_type] || OPPORTUNITY_CONFIG.observed;

            return (
              <div key={result.ticker} className={`card p-4 border ${statusCfg.bg} card-hover`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setSelectedTicker(result.ticker); setActiveView("ticker"); }}
                        className="text-lg font-bold text-white hover:text-blue-400 transition-colors"
                      >
                        {result.ticker}
                      </button>
                      {result.company_name && (
                        <span className="text-xs text-slate-500">{result.company_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${statusCfg.bg} ${statusCfg.color}`}>
                        {statusCfg.icon} {statusCfg.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        Ryzyko: <span className={riskCfg.color}>{riskCfg.label}</span>
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${opportunityCfg.style}`}>
                        {opportunityCfg.label}
                      </span>
                      {(result.scanner_types || []).map(type => (
                        <span key={type} className={`rounded-full border px-2 py-0.5 text-[10px] ${(SCANNER_TYPE_CONFIG[type] || SCANNER_TYPE_CONFIG.general).style}`}>
                          {(SCANNER_TYPE_CONFIG[type] || SCANNER_TYPE_CONFIG.general).label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-base font-semibold text-white">${result.price.toFixed(2)}</div>
                    <PriceChange value={result.change_pct} className="text-sm" />
                    <div className="mt-1">
                      <SignalBadge signal={result.overall_signal} size="sm" />
                    </div>
                    <button
                      onClick={() => saveToWatchlist(result.ticker)}
                      disabled={savingTicker === result.ticker}
                      className="mt-2 rounded border border-slate-700 bg-slate-900/70 px-2 py-1 text-[10px] text-slate-300 transition-colors hover:border-blue-500/50 hover:text-blue-300 disabled:opacity-50"
                    >
                      {savingTicker === result.ticker
                        ? "Zapisuję..."
                        : result.is_watchlisted
                          ? "Aktualizuj watchlistę"
                          : "Dodaj do watchlisty"}
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-800/50 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] text-slate-600 mb-1.5 font-medium">POWODY WYKRYCIA</div>
                      <ul className="space-y-1">
                        {result.reasons.map((reason, i) => (
                          <li key={i} className="text-xs text-slate-300 flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusCfg.color.replace("text-", "bg-")}`} />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-600 mb-1.5 font-medium">WSKAŹNIKI POTWIERDZAJĄCE</div>
                      <div className="flex flex-wrap gap-1">
                        {result.confirming_indicators.map((ind, i) => (
                          <span key={i} className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                            {ind}
                          </span>
                        ))}
                      </div>
                      {result.rsi !== null && (
                        <div className="mt-2 text-xs text-slate-500">
                          RSI: <span className={
                            result.rsi > 70 ? "text-red-400" :
                            result.rsi < 30 ? "text-emerald-400" : "text-slate-300"
                          }>{result.rsi.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="card p-12 text-center text-slate-600">
              <Search size={32} className="mx-auto mb-2 opacity-30" />
              <div className="text-sm">
                {results.length === 0
                  ? "Brak sygnałów. Uruchom analizę, aby wygenerować dane techniczne."
                  : "Brak sygnałów w tej kategorii."}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="text-xs text-slate-700 text-center">
        ⚠ Skaner to narzędzie obserwacji sygnałów technicznych. Nie stanowi porady inwestycyjnej.
      </div>
    </div>
  );
}
