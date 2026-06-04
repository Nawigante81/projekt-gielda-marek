"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Loader2, RefreshCw } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

interface EarningsEvent {
  id: number;
  title: string;
  ticker: string | null;
  event_date: string;
  impact: string | null;
  source: string | null;
  details_json: string | null;
}

interface EarningsResponse {
  events: EarningsEvent[];
  buckets: {
    today: EarningsEvent[];
    tomorrow: EarningsEvent[];
    thisWeek: EarningsEvent[];
    next30Days: EarningsEvent[];
  };
  alertCount: number;
  refreshedAt: string;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseDetails(value: string | null): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default function EarningsCalendar() {
  const { setSelectedTicker, setActiveView } = useAppStore();
  const [data, setData] = useState<EarningsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchEarnings = useCallback(async () => {
    setLoading(true);
    await fetch("/api/market-events");
    const res = await fetch("/api/earnings-calendar");
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchEarnings();
  }, [fetchEarnings]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={24} /></div>;
  }

  const buckets = [
    { label: "Dzisiaj", rows: data?.buckets.today || [] },
    { label: "Jutro", rows: data?.buckets.tomorrow || [] },
    { label: "Ten tydzień", rows: data?.buckets.thisWeek || [] },
    { label: "30 dni", rows: data?.buckets.next30Days || [] },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
            <CalendarDays size={18} className="text-blue-400" /> Earnings calendar
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {data?.events.length || 0} nadchodzących publikacji wyników • alerty utworzone: {data?.alertCount || 0}
          </p>
        </div>
        <button
          onClick={fetchEarnings}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <RefreshCw size={14} /> Odśwież
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium text-white">{bucket.label}</div>
              <div className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{bucket.rows.length}</div>
            </div>
            <div className="space-y-2">
              {bucket.rows.slice(0, 6).map((event) => (
                <button
                  key={`${bucket.label}-${event.id}`}
                  onClick={() => {
                    if (event.ticker) {
                      setSelectedTicker(event.ticker);
                      setActiveView("ticker");
                    }
                  }}
                  className="w-full rounded-md border border-slate-800 bg-slate-900/60 p-2 text-left transition-colors hover:border-blue-500/40"
                >
                  <div className="text-sm font-semibold text-white">{event.ticker || "—"}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{formatDate(event.event_date)}</div>
                </button>
              ))}
              {bucket.rows.length === 0 && <div className="text-xs text-slate-600">Brak publikacji</div>}
            </div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Ticker</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Tytuł</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Data</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">Źródło</th>
            </tr>
          </thead>
          <tbody>
            {(data?.events || []).map((event) => {
              const details = parseDetails(event.details_json);
              return (
                <tr key={event.id} className="border-b border-slate-800/50 transition-colors hover:bg-slate-800/20">
                  <td className="px-4 py-3">
                    {event.ticker ? (
                      <button
                        onClick={() => {
                          setSelectedTicker(event.ticker);
                          setActiveView("ticker");
                        }}
                        className="font-mono text-sm font-semibold text-white hover:text-blue-400"
                      >
                        {event.ticker}
                      </button>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-slate-300">{event.title}</div>
                    {details.earningsAverage !== undefined && (
                      <div className="mt-0.5 text-[11px] text-slate-600">EPS avg: {String(details.earningsAverage)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">{formatDate(event.event_date)}</td>
                  <td className="px-4 py-3 text-right text-xs text-slate-500">{event.source || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(data?.events.length || 0) === 0 && (
          <div className="p-12 text-center text-slate-600">
            <CalendarDays size={32} className="mx-auto mb-2 opacity-30" />
            <div className="text-sm">Brak earnings w kalendarzu. Dodaj tickery do portfolio/watchlisty i odśwież.</div>
          </div>
        )}
      </div>
    </div>
  );
}
