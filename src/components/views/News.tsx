"use client";

import { useCallback, useEffect, useState } from "react";
import { Newspaper, RefreshCw, Loader2, ExternalLink, Search } from "lucide-react";
import PriceChange from "@/components/PriceChange";
import { useAppStore } from "@/store/useAppStore";

interface NewsItem {
  id: number;
  ticker: string;
  headline: string;
  summary: string | null;
  url: string | null;
  source: string | null;
  published_at: string | null;
  sentiment_label: "positive" | "neutral" | "negative" | null;
  sentiment_score: number | null;
  impact_score: number | null;
}

const sentimentStyles = {
  positive: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  neutral: "border-slate-700 bg-slate-900 text-slate-400",
  negative: "border-red-500/30 bg-red-500/10 text-red-400",
};

function formatDate(value: string | null): string {
  if (!value) return "brak daty";
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

export default function News() {
  const { setSelectedTicker, setActiveView } = useAppStore();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tickerFilter, setTickerFilter] = useState("");
  const [activeTicker, setActiveTicker] = useState("");

  const fetchNews = useCallback(async (ticker = activeTicker) => {
    setLoading(true);
    const params = ticker ? `?ticker=${encodeURIComponent(ticker.toUpperCase())}` : "";
    const res = await fetch(`/api/news${params}`);
    if (res.ok) {
      setItems(await res.json());
    }
    setLoading(false);
  }, [activeTicker]);

  useEffect(() => {
    void fetchNews("");
  }, [fetchNews]);

  const applyTickerFilter = () => {
    const normalized = tickerFilter.trim().toUpperCase();
    setActiveTicker(normalized);
    void fetchNews(normalized);
  };

  const clearTickerFilter = () => {
    setTickerFilter("");
    setActiveTicker("");
    void fetchNews("");
  };

  const sentimentCounts = items.reduce(
    (acc, item) => {
      const label = item.sentiment_label || "neutral";
      acc[label] += 1;
      return acc;
    },
    { positive: 0, neutral: 0, negative: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
            <Newspaper size={18} className="text-blue-400" /> Newsy rynkowe
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {items.length} wiadomości {activeTicker ? `dla ${activeTicker}` : "z ostatniej analizy"}.
          </p>
        </div>
        <button
          onClick={() => fetchNews()}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <RefreshCw size={14} /> Odśwież
        </button>
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-medium text-white">Filtr po tickerze</div>
            <div className="text-xs text-slate-500">Zostaw puste, żeby pokazać najnowsze newsy ze wszystkich spółek.</div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-sm uppercase text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none sm:w-48"
                placeholder="NVDA"
                value={tickerFilter}
                onChange={(event) => setTickerFilter(event.target.value.toUpperCase())}
                onKeyDown={(event) => event.key === "Enter" && applyTickerFilter()}
              />
            </div>
            <button
              onClick={applyTickerFilter}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700"
            >
              Filtruj
            </button>
            {activeTicker && (
              <button
                onClick={clearTickerFilter}
                className="rounded-md px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                Wyczyść
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <div className={`rounded-md border px-3 py-2 text-xs ${sentimentStyles.positive}`}>
            Pozytywne: {sentimentCounts.positive}
          </div>
          <div className={`rounded-md border px-3 py-2 text-xs ${sentimentStyles.neutral}`}>
            Neutralne: {sentimentCounts.neutral}
          </div>
          <div className={`rounded-md border px-3 py-2 text-xs ${sentimentStyles.negative}`}>
            Negatywne: {sentimentCounts.negative}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <Loader2 className="animate-spin text-blue-500" size={24} />
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => {
            const sentiment = item.sentiment_label || "neutral";
            return (
              <article key={item.id} className="card p-4 transition-colors hover:border-slate-700">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedTicker(item.ticker);
                          setActiveView("ticker");
                        }}
                        className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-xs text-blue-300 transition-colors hover:border-blue-400 hover:text-blue-200"
                      >
                        {item.ticker}
                      </button>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${sentimentStyles[sentiment]}`}>
                        {sentiment}
                      </span>
                      <span className="text-[11px] text-slate-600">{item.source || "unknown"}</span>
                      <span className="text-[11px] text-slate-600">{formatDate(item.published_at)}</span>
                    </div>

                    <h2 className="text-sm font-semibold leading-6 text-white">{item.headline}</h2>
                    {item.summary && (
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">{item.summary}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-3 lg:flex-col lg:items-end">
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-slate-600">Sentyment</div>
                      <PriceChange value={item.sentiment_score} className="text-sm" />
                      {item.impact_score !== null && (
                        <div className="mt-1 text-[11px] text-slate-500">Impact: {item.impact_score.toFixed(1)}</div>
                      )}
                    </div>

                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-md border border-slate-800 px-2 py-1 text-xs text-slate-400 transition-colors hover:border-blue-500/50 hover:text-blue-300"
                      >
                        Źródło <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {items.length === 0 && (
            <div className="card p-12 text-center text-slate-600">
              <Newspaper size={32} className="mx-auto mb-2 opacity-30" />
              <div className="text-sm">Brak newsów. Uruchom analizę lub sprawdź konfigurację źródeł danych.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
