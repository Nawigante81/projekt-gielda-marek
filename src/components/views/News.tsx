"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  Newspaper,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

type SentimentLabel = "positive" | "neutral" | "negative";
type ImpactLabel = "High Impact" | "Medium Impact" | "Low Impact";

interface NewsListItem {
  id: number;
  ticker: string;
  headline: string;
  summary: string;
  clean_summary: string;
  source: string;
  url: string | null;
  published_at: string | null;
  sentiment_label: SentimentLabel;
  sentiment_score: number;
  impact_score: number;
  impact_label: ImpactLabel;
  priority_category: string;
  priority_rank: number;
  priority_score: number;
  ai_summary: string[];
  is_portfolio: boolean;
}

interface NewsPayload {
  items: NewsListItem[];
  topEvents: Array<{
    id: number;
    ticker: string;
    headline: string;
    impact_label: ImpactLabel;
    summary: string;
    sentiment_label: SentimentLabel;
    priority_category: string;
  }>;
  portfolioNews: NewsListItem[];
  stats: {
    total: number;
    bullishPct: number;
    neutralPct: number;
    bearishPct: number;
    sentimentScore: number;
  };
  sources: string[];
}

const sentimentBadgeStyles: Record<SentimentLabel, string> = {
  positive: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  neutral: "border-slate-700 bg-slate-900 text-slate-300",
  negative: "border-red-500/30 bg-red-500/10 text-red-300",
};

const impactBadgeStyles: Record<ImpactLabel, string> = {
  "High Impact": "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300",
  "Medium Impact": "border-amber-500/30 bg-amber-500/10 text-amber-300",
  "Low Impact": "border-slate-700 bg-slate-900 text-slate-300",
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

function formatRelativeDate(value: string | null): string {
  if (!value) return "brak daty";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffHours = (Date.now() - date.getTime()) / 3600000;
  if (diffHours < 1) return "przed chwilą";
  if (diffHours < 24) return `${Math.round(diffHours)} h temu`;
  return `${Math.round(diffHours / 24)} d temu`;
}

function sentimentLabelText(value: SentimentLabel): string {
  if (value === "positive") return "Bullish";
  if (value === "negative") return "Bearish";
  return "Neutral";
}

function sentimentTone(value: number): string {
  if (value >= 25) return "text-emerald-300";
  if (value <= -25) return "text-red-300";
  return "text-slate-200";
}

function buildQuery(filters: {
  ticker: string;
  sentiment: string;
  impact: string;
  source: string;
  dateFrom: string;
  dateTo: string;
  portfolioOnly: boolean;
}): string {
  const params = new URLSearchParams();
  if (filters.ticker) params.set("ticker", filters.ticker.toUpperCase());
  if (filters.sentiment) params.set("sentiment", filters.sentiment);
  if (filters.impact) params.set("impact", filters.impact);
  if (filters.source) params.set("source", filters.source);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.portfolioOnly) params.set("portfolio_only", "1");
  const query = params.toString();
  return query ? `?${query}` : "";
}

export default function News() {
  const { setSelectedTicker, setActiveView } = useAppStore();
  const [payload, setPayload] = useState<NewsPayload>({
    items: [],
    topEvents: [],
    portfolioNews: [],
    stats: { total: 0, bullishPct: 0, neutralPct: 0, bearishPct: 0, sentimentScore: 0 },
    sources: [],
  });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filters, setFilters] = useState({
    ticker: "",
    sentiment: "",
    impact: "",
    source: "",
    dateFrom: "",
    dateTo: "",
    portfolioOnly: false,
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const fetchNews = useCallback(async (nextFilters = appliedFilters) => {
    setLoading(true);
    const response = await fetch(`/api/news${buildQuery(nextFilters)}`);
    if (response.ok) {
      setPayload(await response.json());
    }
    setLoading(false);
  }, [appliedFilters]);

  useEffect(() => {
    void fetchNews(filters);
  }, [fetchNews]);

  const items = payload.items;
  const hasFilters = useMemo(
    () => Boolean(appliedFilters.ticker || appliedFilters.sentiment || appliedFilters.impact || appliedFilters.source || appliedFilters.dateFrom || appliedFilters.dateTo || appliedFilters.portfolioOnly),
    [appliedFilters]
  );

  const applyFilters = () => {
    setAppliedFilters(filters);
    void fetchNews(filters);
  };

  const clearFilters = () => {
    const cleared = {
      ticker: "",
      sentiment: "",
      impact: "",
      source: "",
      dateFrom: "",
      dateTo: "",
      portfolioOnly: false,
    };
    setFilters(cleared);
    setAppliedFilters(cleared);
    void fetchNews(cleared);
  };

  const openTicker = (ticker: string) => {
    setSelectedTicker(ticker);
    setActiveView("ticker");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-white">
            <Newspaper size={18} className="text-blue-400" /> Newsy rynkowe
          </h1>
          <p className="mt-0.5 max-w-3xl text-xs text-slate-500">
            Zwarty terminal newsowy z priorytetyzacją AI, czystym opisem wiadomości i szybkim wychwytywaniem katalizatorów inwestycyjnych.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowMobileFilters((current) => !current)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-slate-700 hover:text-white lg:hidden"
          >
            <SlidersHorizontal size={14} /> Filtry
          </button>
          <button
            onClick={() => fetchNews()}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
          >
            <RefreshCw size={14} /> Odśwież
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:items-start xl:grid-cols-[1.4fr_0.9fr]">
        <section className="card overflow-hidden p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Top Events Today</div>
              <div className="mt-1 text-sm text-white">Najważniejsze wydarzenia wybrane według ważności i wpływu.</div>
            </div>
            <Sparkles size={16} className="text-amber-300" />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {payload.topEvents.length > 0 ? payload.topEvents.map((item) => (
              <button
                key={item.id}
                onClick={() => openTicker(item.ticker)}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-left transition-colors hover:border-slate-700"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-xs text-blue-300">{item.ticker}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${impactBadgeStyles[item.impact_label]}`}>{item.impact_label}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${sentimentBadgeStyles[item.sentiment_label]}`}>{sentimentLabelText(item.sentiment_label)}</span>
                </div>
                <div className="text-sm font-semibold leading-6 text-white">{item.headline}</div>
                <div className="mt-2 text-xs leading-5 text-slate-400">{item.summary}</div>
              </button>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/40 p-5 text-sm text-slate-500">
                Brak newsów spełniających obecne filtry.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4">
          <div className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Sentiment Radar</div>
            <div className={`mt-2 text-3xl font-semibold ${sentimentTone(payload.stats.sentimentScore)}`}>
              {payload.stats.sentimentScore >= 0 ? "+" : ""}{payload.stats.sentimentScore}
            </div>
            <div className="mt-1 text-xs text-slate-500">Sentiment Score od -100 do +100</div>
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm">
                <span className="text-emerald-300">Bullish</span>
                <span className="font-mono text-white">{payload.stats.bullishPct}%</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-sm">
                <span className="text-slate-300">Neutral</span>
                <span className="font-mono text-white">{payload.stats.neutralPct}%</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-sm">
                <span className="text-red-300">Bearish</span>
                <span className="font-mono text-white">{payload.stats.bearishPct}%</span>
              </div>
            </div>
          </div>

          <div className="card p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Portfolio News</div>
            <div className="mt-1 text-sm text-white">Wiadomości dotyczące Twojego portfela.</div>
            <div className="mt-3 space-y-2">
              {payload.portfolioNews.length > 0 ? payload.portfolioNews.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  onClick={() => openTicker(item.ticker)}
                  className="flex w-full items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-3 text-left transition-colors hover:border-slate-700"
                >
                  <Star size={14} className="mt-0.5 shrink-0 text-amber-300" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm text-white">{item.ticker}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${sentimentBadgeStyles[item.sentiment_label]}`}>{sentimentLabelText(item.sentiment_label)}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${impactBadgeStyles[item.impact_label]}`}>{item.impact_label}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">{item.headline}</div>
                  </div>
                </button>
              )) : (
                <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950/30 px-3 py-4 text-sm text-slate-500">
                  Brak świeżych wiadomości dla aktywnych pozycji z portfolio.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-medium text-white">Filtry analityczne</div>
            <div className="text-xs text-slate-500">Ticker, sentyment, wpływ, źródło, zakres dat oraz tylko portfolio mogą działać jednocześnie.</div>
          </div>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="hidden rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-700 hover:text-white lg:inline-flex"
            >
              Wyczyść filtry
            </button>
          )}
        </div>

        <div className={`${showMobileFilters ? "mt-4" : "mt-4 hidden"} lg:block`}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative xl:col-span-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                className="w-full rounded-md border border-slate-800 bg-slate-900 py-2 pl-9 pr-3 text-sm uppercase text-white placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                placeholder="Ticker"
                value={filters.ticker}
                onChange={(event) => setFilters((current) => ({ ...current, ticker: event.target.value.toUpperCase() }))}
                onKeyDown={(event) => event.key === "Enter" && applyFilters()}
              />
            </div>

            <select
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              value={filters.sentiment}
              onChange={(event) => setFilters((current) => ({ ...current, sentiment: event.target.value }))}
            >
              <option value="">Wszystkie sentymenty</option>
              <option value="positive">Bullish</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Bearish</option>
            </select>

            <select
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              value={filters.impact}
              onChange={(event) => setFilters((current) => ({ ...current, impact: event.target.value }))}
            >
              <option value="">Każdy wpływ</option>
              <option value="High Impact">High Impact</option>
              <option value="Medium Impact">Medium Impact</option>
              <option value="Low Impact">Low Impact</option>
            </select>

            <select
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              value={filters.source}
              onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))}
            >
              <option value="">Każde źródło</option>
              {payload.sources.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>

            <input
              type="date"
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              value={filters.dateFrom}
              onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
            />

            <input
              type="date"
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              value={filters.dateTo}
              onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
            />
          </div>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={filters.portfolioOnly}
                onChange={(event) => setFilters((current) => ({ ...current, portfolioOnly: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500"
              />
              Tylko portfolio
            </label>

            <div className="flex flex-wrap gap-2">
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-400 transition-colors hover:border-slate-700 hover:text-white lg:hidden"
                >
                  Wyczyść
                </button>
              )}
              <button
                onClick={applyFilters}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white transition-colors hover:bg-blue-700"
              >
                Zastosuj filtry
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-slate-800 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white">Lista newsów</div>
              <div className="text-xs text-slate-500">
                Domyślnie sortowane według ważności AI, a dopiero potem według czasu publikacji.
              </div>
            </div>
            <div className="text-xs text-slate-500">{payload.stats.total} pozycji</div>
          </div>
        </div>

        <div className="hidden grid-cols-[0.8fr_0.9fr_1.1fr_3fr_1.4fr_1.4fr_44px] gap-3 border-b border-slate-800 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-slate-500 lg:grid">
          <div>Ticker</div>
          <div>Sentyment</div>
          <div>Wpływ</div>
          <div>Tytuł</div>
          <div>Źródło</div>
          <div>Data</div>
          <div />
        </div>

        {loading ? (
          <div className="flex h-52 items-center justify-center">
            <Loader2 className="animate-spin text-blue-500" size={24} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            <Newspaper size={30} className="mx-auto mb-2 opacity-30" />
            <div className="text-sm">Brak newsów dla wybranych filtrów lub ostatniej analizy.</div>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {items.map((item) => {
              const isExpanded = expanded === item.id;
              return (
                <article key={item.id} className="bg-transparent">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpanded(isExpanded ? null : item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setExpanded(isExpanded ? null : item.id);
                      }
                    }}
                    className="w-full px-4 py-4 text-left transition-colors hover:bg-slate-950/40"
                  >
                    <div className="hidden items-center gap-3 lg:grid lg:grid-cols-[0.8fr_0.9fr_1.1fr_3fr_1.4fr_1.4fr_44px]">
                      <div className="flex items-center gap-2">
                        {item.is_portfolio && <Star size={13} className="text-amber-300" />}
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            openTicker(item.ticker);
                          }}
                          className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-xs text-blue-300 transition-colors hover:border-blue-400 hover:text-blue-200"
                        >
                          {item.ticker}
                        </button>
                      </div>
                      <div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${sentimentBadgeStyles[item.sentiment_label]}`}>
                          {sentimentLabelText(item.sentiment_label)}
                        </span>
                      </div>
                      <div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] ${impactBadgeStyles[item.impact_label]}`}>
                          {item.impact_label}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">{item.headline}</div>
                        <div className="mt-1 text-xs text-slate-500">{item.priority_category}</div>
                      </div>
                      <div className="text-sm text-slate-300">{item.source}</div>
                      <div className="text-xs text-slate-500">
                        <div>{formatDate(item.published_at)}</div>
                        <div className="mt-0.5">{formatRelativeDate(item.published_at)}</div>
                      </div>
                      <div className="flex justify-end text-slate-500">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    <div className="lg:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            {item.is_portfolio && <Star size={13} className="text-amber-300" />}
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                openTicker(item.ticker);
                              }}
                              className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-xs text-blue-300"
                            >
                              {item.ticker}
                            </button>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${sentimentBadgeStyles[item.sentiment_label]}`}>
                              {sentimentLabelText(item.sentiment_label)}
                            </span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${impactBadgeStyles[item.impact_label]}`}>
                              {item.impact_label}
                            </span>
                          </div>
                          <div className="text-sm font-medium leading-6 text-white">{item.headline}</div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                            <span>{item.source}</span>
                            <span>{formatRelativeDate(item.published_at)}</span>
                            <span>{item.priority_category}</span>
                          </div>
                        </div>
                        <div className="pt-1 text-slate-500">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-800 bg-slate-950/40 px-4 py-4">
                      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                        <div className="space-y-4">
                          <div>
                            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">AI Summary</div>
                            <ul className="space-y-2">
                              {item.ai_summary.map((bullet, index) => (
                                <li key={`${item.id}-bullet-${index}`} className="flex items-start gap-2 text-sm leading-6 text-slate-300">
                                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-400" />
                                  <span>{bullet}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pełny opis</div>
                            <p className="text-sm leading-6 text-slate-400">{item.clean_summary || item.summary || "Brak dodatkowego opisu."}</p>
                          </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Ocena wpływu</div>
                            <div className={`mt-2 text-sm font-semibold ${impactBadgeStyles[item.impact_label].split(" ").slice(-1)[0]}`}>{item.impact_label}</div>
                            <div className="mt-2 text-xs text-slate-500">Kategoria: {item.priority_category}</div>
                            <div className="mt-1 text-xs text-slate-500">Priority rank: {item.priority_rank}</div>
                          </div>

                          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Sentyment i ważność</div>
                            <div className={`mt-2 text-sm font-semibold ${sentimentTone(item.sentiment_score)}`}>
                              {item.sentiment_score >= 0 ? "+" : ""}{item.sentiment_score.toFixed(0)}
                            </div>
                            <div className="mt-2 text-xs text-slate-500">Impact score: {item.impact_score.toFixed(1)}</div>
                            <div className="mt-1 text-xs text-slate-500">Priority score: {item.priority_score.toFixed(1)}</div>
                          </div>

                          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 sm:col-span-2 xl:col-span-1">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Źródło</div>
                            <div className="mt-2 text-sm text-white">{item.source}</div>
                            <div className="mt-1 text-xs text-slate-500">{formatDate(item.published_at)}</div>
                            {item.url && (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 inline-flex items-center gap-1 rounded-md border border-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:border-blue-500/50 hover:text-blue-300"
                              >
                                Czytaj artykuł <ExternalLink size={13} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
