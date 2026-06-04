"use client";

import { CalendarDays } from "lucide-react";

export interface DashboardEventItem {
  id: number;
  title: string;
  ticker: string | null;
  event_type?: string;
  event_date: string;
  impact?: string | null;
  source?: string | null;
}

export interface DashboardEarningsItem {
  id: number;
  title: string;
  ticker: string | null;
  event_date: string;
  impact: string | null;
  source: string | null;
}

function formatDaysUntil(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "brak daty";
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const days = Math.ceil((timestamp - startToday.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "po terminie";
  if (days === 0) return "dzisiaj";
  if (days === 1) return "jutro";
  return `${days} dni`;
}

function getEventImpactTone(event: { impact?: string | null; event_type?: string }): string {
  const impact = (event.impact || "").toLowerCase();
  const type = (event.event_type || "").toUpperCase();
  if (impact.includes("high") || impact.includes("wysoki") || ["CPI", "PPI", "NFP", "FOMC", "FED", "GDP"].includes(type)) {
    return "border-red-700/40 bg-red-900/20 text-red-300";
  }
  if (impact.includes("medium") || impact.includes("śre")) {
    return "border-amber-700/40 bg-amber-900/20 text-amber-300";
  }
  return "border-slate-800 bg-slate-900/60 text-slate-300";
}

interface DashboardEventsCalendarProps {
  events: DashboardEventItem[];
  earnings: DashboardEarningsItem[];
  onOpenTicker: (ticker: string) => void;
  onOpenMarket: () => void;
}

export default function DashboardEventsCalendar({ events, earnings, onOpenTicker, onOpenMarket }: DashboardEventsCalendarProps) {
  const totalRows = events.length + earnings.length;
  if (totalRows === 0) {
    return (
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
            <CalendarDays size={15} className="text-blue-400" /> Kalendarz wydarzeń
          </div>
          <div className="text-xs text-slate-500">0 pozycji</div>
        </div>
        <div className="rounded-md border border-dashed border-slate-800 bg-slate-950/40 px-3 py-4 text-sm text-slate-500">
          Brak aktywnych sygnałów. Uruchom analizę lub rozszerz watchlistę.
        </div>
      </div>
    );
  }

  const buckets = [
    { label: "Dzisiaj", rows: [...earnings.filter((event) => formatDaysUntil(event.event_date) === "dzisiaj"), ...events.filter((event) => formatDaysUntil(event.event_date) === "dzisiaj")] },
    { label: "Jutro", rows: [...earnings.filter((event) => formatDaysUntil(event.event_date) === "jutro"), ...events.filter((event) => formatDaysUntil(event.event_date) === "jutro")] },
    { label: "Ten tydzień", rows: [...earnings.filter((event) => Number.parseInt(formatDaysUntil(event.event_date), 10) <= 7 || formatDaysUntil(event.event_date) === "dzisiaj" || formatDaysUntil(event.event_date) === "jutro"), ...events.filter((event) => ["dzisiaj", "jutro"].includes(formatDaysUntil(event.event_date)) === false)].slice(0, 8) },
  ];

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <CalendarDays size={15} className="text-blue-400" /> Kalendarz wydarzeń
        </div>
        <div className="text-xs text-slate-500">{totalRows} pozycji</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        {buckets.map((bucket) => (
          <div key={bucket.label} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
            <div className="mb-2 text-xs font-medium text-slate-400">{bucket.label}</div>
            <div className="space-y-2">
              {bucket.rows.length > 0 ? bucket.rows.slice(0, 6).map((event) => (
                <button
                  key={`${bucket.label}-${event.id}`}
                  onClick={() => event.ticker ? onOpenTicker(event.ticker) : onOpenMarket()}
                  className={`w-full rounded-md border p-2 text-left transition-colors hover:border-blue-500/40 ${getEventImpactTone(event)}`}
                >
                  <div className="text-sm text-white">{event.ticker ? `${event.ticker} • ` : ""}{event.title}</div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    {new Date(event.event_date).toLocaleString("pl-PL")} • {"event_type" in event ? event.event_type : "earnings"}
                  </div>
                </button>
              )) : (
                <div className="text-xs text-slate-600">Brak wydarzeń</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
