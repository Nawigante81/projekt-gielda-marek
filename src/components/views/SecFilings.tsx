"use client";

import { useCallback, useEffect, useState } from "react";
import { FileSearch, Loader2, RefreshCw, ExternalLink, Search } from "lucide-react";
import toast from "react-hot-toast";
import { useAppStore } from "@/store/useAppStore";

interface SecFiling {
  id: number;
  ticker: string;
  cik: string;
  company_name: string | null;
  form: string;
  accession_number: string;
  filing_date: string;
  report_date: string | null;
  primary_document: string | null;
  filing_url: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

const formStyles: Record<string, string> = {
  "10-K": "border-blue-500/30 bg-blue-500/10 text-blue-300",
  "10-Q": "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  "8-K": "border-amber-500/30 bg-amber-500/10 text-amber-300",
  "S-1": "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300",
  "DEF 14A": "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  "4": "border-slate-700 bg-slate-900 text-slate-300",
  "13F-HR": "border-violet-500/30 bg-violet-500/10 text-violet-300",
};

function formatDate(value: string | null): string {
  if (!value) return "brak";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pl-PL");
}

export default function SecFilings() {
  const { setSelectedTicker, setActiveView } = useAppStore();
  const [items, setItems] = useState<SecFiling[]>([]);
  const [ticker, setTicker] = useState("");
  const [activeTicker, setActiveTicker] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFilings = useCallback(async (nextTicker = activeTicker) => {
    setLoading(true);
    const params = nextTicker ? `?ticker=${encodeURIComponent(nextTicker)}` : "";
    const res = await fetch(`/api/sec-filings${params}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [activeTicker]);

  useEffect(() => {
    void fetchFilings("");
  }, [fetchFilings]);

  const applyTicker = () => {
    const normalized = ticker.trim().toUpperCase();
    setActiveTicker(normalized);
    void fetchFilings(normalized);
  };

  const refreshTicker = async () => {
    const normalized = (ticker || activeTicker).trim().toUpperCase();
    if (!normalized) {
      toast.error("Podaj ticker do odświeżenia SEC");
      return;
    }

    setRefreshing(true);
    try {
      const res = await fetch("/api/sec-filings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: normalized }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Nie udało się pobrać SEC");
        return;
      }
      setTicker(normalized);
      setActiveTicker(normalized);
      setItems(data.filings);
      toast.success(`SEC odświeżone dla ${normalized}`);
    } finally {
      setRefreshing(false);
    }
  };

  const clearTicker = () => {
    setTicker("");
    setActiveTicker("");
    void fetchFilings("");
  };
  const hasItems = items.length > 0;
  const formCounts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.form] = (acc[item.form] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
            <FileSearch size={18} className="text-blue-400" /> SEC / raporty
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {items.length} dokumentów {activeTicker ? `dla ${activeTicker}` : "w lokalnej bazie"}.
          </p>
        </div>
        <button
          onClick={refreshTicker}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Pobierz z SEC
        </button>
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-medium text-white">Ticker spółki</div>
            <div className="text-xs text-slate-500">Pobieramy realne zgłoszenia z publicznego SEC submissions API.</div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-sm uppercase text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none sm:w-48"
                placeholder="AAPL"
                value={ticker}
                onChange={(event) => setTicker(event.target.value.toUpperCase())}
                onKeyDown={(event) => event.key === "Enter" && applyTicker()}
              />
            </div>
            <button
              onClick={applyTicker}
              className="rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-blue-500/50 hover:text-blue-300"
            >
              Filtruj
            </button>
            {activeTicker && (
              <button
                onClick={clearTicker}
                className="rounded-md px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                Wyczyść
              </button>
            )}
          </div>
        </div>
      </div>

      {hasItems && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "8-K", value: formCounts["8-K"] || 0 },
            { label: "10-Q", value: formCounts["10-Q"] || 0 },
            { label: "10-K", value: formCounts["10-K"] || 0 },
            { label: "Insider Trading", value: formCounts["4"] || 0 },
            { label: "Institutional Ownership", value: formCounts["13F-HR"] || 0 },
          ].map((metric) => (
            <div key={metric.label} className="card p-3">
              <div className="text-[11px] text-slate-500">{metric.label}</div>
              <div className="mt-1 font-mono text-xl text-white">{metric.value}</div>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" size={24} />
        </div>
      ) : hasItems ? (
        <div className="card overflow-x-auto">
          <div className="hidden md:block">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Ticker</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Formularz</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Spółka</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Filing date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Report date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Dokument</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-800/50 transition-colors hover:bg-slate-800/20">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setSelectedTicker(item.ticker);
                          setActiveView("ticker");
                        }}
                        className="font-mono text-sm font-semibold text-white transition-colors hover:text-blue-400"
                      >
                        {item.ticker}
                      </button>
                      <div className="text-[10px] text-slate-600">CIK {item.cik}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${formStyles[item.form] || formStyles["4"]}`}>
                        {item.form}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-300">{item.company_name || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">{formatDate(item.filing_date)}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">{formatDate(item.report_date)}</td>
                    <td className="px-4 py-3 text-right">
                      {item.filing_url ? (
                        <a
                          href={item.filing_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                        >
                          Otwórz <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-xs text-slate-700">brak</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 p-3 md:hidden">
            {items.map((item) => (
              <div key={item.id} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <button
                      onClick={() => {
                        setSelectedTicker(item.ticker);
                        setActiveView("ticker");
                      }}
                      className="font-mono text-sm font-semibold text-white"
                    >
                      {item.ticker}
                    </button>
                    <div className="text-[11px] text-slate-500">{item.company_name || "—"}</div>
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${formStyles[item.form] || formStyles["4"]}`}>
                    {item.form}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-slate-950/60 p-2 text-slate-500">Filing: {formatDate(item.filing_date)}</div>
                  <div className="rounded bg-slate-950/60 p-2 text-slate-500">Report: {formatDate(item.report_date)}</div>
                </div>
                {item.filing_url && (
                  <a
                    href={item.filing_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs text-blue-400"
                  >
                    Otwórz dokument <ExternalLink size={11} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-6 sm:p-8 text-center text-slate-500">
          <FileSearch size={30} className="mx-auto mb-3 opacity-30" />
          <div className="text-sm text-slate-300">Brak dokumentów SEC w lokalnej bazie.</div>
          <div className="mt-2 text-xs text-slate-600">Wpisz ticker, na przykład `AAPL`, a potem kliknij `Pobierz z SEC`, aby zaciągnąć realne filingi.</div>
        </div>
      )}
    </div>
  );
}
