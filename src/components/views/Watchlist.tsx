"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Plus, Trash2, Eye, X, Loader2 } from "lucide-react";
import SignalBadge from "@/components/SignalBadge";
import PriceChange from "@/components/PriceChange";
import toast from "react-hot-toast";

interface WatchlistItem {
  id: number;
  ticker: string;
  company_name: string;
  notes: string;
  group_name: string;
  watchlist_id: number | null;
  watchlist_name: string | null;
  watchlist_color: string | null;
  auto_analyze: number;
  current_price: number | null;
  change_pct: number | null;
  volume: number | null;
  overall_signal: string | null;
  ai_score: number | null;
  recommendation: string | null;
  news_sentiment_score: number | null;
  news_sentiment_label: string | null;
  signal_macd: string | null;
  rsi_14: number | null;
  latest_news: string | null;
  latest_alert: string | null;
}

interface WatchlistGroup {
  id: number;
  name: string;
  color: string;
  auto_analyze: number;
  ticker_count: number;
}

export default function Watchlist() {
  const { setSelectedTicker, setActiveView } = useAppStore();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [groups, setGroups] = useState<WatchlistGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ticker: "", company_name: "", notes: "", group_name: "TECH", watchlist_id: "", auto_analyze: true });
  const [groupFilter, setGroupFilter] = useState<string>("ALL");

  const fetchWatchlist = useCallback(async () => {
    const [itemsRes, groupsRes] = await Promise.all([
      fetch("/api/watchlist"),
      fetch("/api/watchlists"),
    ]);
    if (itemsRes.ok) setItems(await itemsRes.json());
    if (groupsRes.ok) setGroups(await groupsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchWatchlist(); }, [fetchWatchlist]);

  const handleAdd = async () => {
    if (!form.ticker) { toast.error("Podaj ticker"); return; }
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker: form.ticker.toUpperCase(),
        company_name: form.company_name,
        notes: form.notes,
        group_name: form.group_name,
        watchlist_id: form.watchlist_id ? Number(form.watchlist_id) : null,
        auto_analyze: form.auto_analyze,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(`${form.ticker.toUpperCase()} dodany do watchlisty`);
      setShowForm(false);
      setForm({ ticker: "", company_name: "", notes: "", group_name: "TECH", watchlist_id: "", auto_analyze: true });
      fetchWatchlist();
    } else {
      toast.error(data.error || "Błąd dodawania");
    }
  };

  const toggleAutoAnalyze = async (item: WatchlistItem) => {
    const res = await fetch(`/api/watchlist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto_analyze: item.auto_analyze !== 1 }),
    });
    if (res.ok) fetchWatchlist();
  };

  const filteredItems = items.filter((item) => groupFilter === "ALL" ? true : (item.group_name || item.watchlist_name || "").toUpperCase() === groupFilter);

  const handleDelete = async (id: number, ticker: string) => {
    if (!confirm(`Usunąć ${ticker} z watchlisty?`)) return;
    await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    toast.success(`${ticker} usunięty z watchlisty`);
    fetchWatchlist();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={24} /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Eye size={18} className="text-blue-400" /> Watchlista
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{items.length} tickerów • {groups.length} grup</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
        >
          <Plus size={14} /> Dodaj ticker
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="card p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">Dodaj do watchlisty</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Ticker *</label>
                <input
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 uppercase"
                  placeholder="PLTR"
                  value={form.ticker}
                  onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                  onKeyDown={e => e.key === "Enter" && handleAdd()}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nazwa spółki</label>
                <input
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  placeholder="Palantir Technologies"
                  value={form.company_name}
                  onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Grupa</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    value={form.watchlist_id}
                    onChange={e => {
                      const selectedGroup = groups.find((group) => String(group.id) === e.target.value);
                      setForm(f => ({
                        ...f,
                        watchlist_id: e.target.value,
                        group_name: selectedGroup?.name || f.group_name,
                        auto_analyze: selectedGroup ? selectedGroup.auto_analyze === 1 : f.auto_analyze,
                      }));
                    }}
                  >
                    <option value="">Bez przypisania</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>{group.name}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-end gap-2 text-sm text-slate-300 pb-2">
                  <input
                    type="checkbox"
                    checked={form.auto_analyze}
                    onChange={e => setForm(f => ({ ...f, auto_analyze: e.target.checked }))}
                  />
                  Auto analiza
                </label>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleAdd} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-medium transition-colors">
                  Dodaj
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded text-sm transition-colors">
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-3">
          <div>
            <div className="text-sm font-medium text-white">Grupy watchlisty</div>
            <div className="text-xs text-slate-500">Filtruj tickery po koszykach AI, TECH, DIVIDEND, ETF lub własnych grupach.</div>
          </div>
          <div className="flex flex-wrap items-center gap-1 bg-slate-900/70 rounded-md p-1">
            {["ALL", ...groups.map((group) => group.name.toUpperCase())].map((group) => (
              <button
                key={group}
                onClick={() => setGroupFilter(group)}
                className={`px-2 py-1 rounded text-xs transition-colors ${groupFilter === group ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}
              >
                {group}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {groups.map((group) => (
            <div key={group.id} className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-white">{group.name}</div>
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: group.color || "#3b82f6" }} />
              </div>
              <div className="text-xs text-slate-500 mt-1">{group.ticker_count} tickerów</div>
              <div className="text-[11px] text-slate-600 mt-1">Auto analiza: {group.auto_analyze === 1 ? "ON" : "OFF"}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card overflow-hidden hidden md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Ticker</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Cena</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Zmiana %</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Wolumen</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">RSI</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">AI Score</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Grupa</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Sygnał</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Ostatni news</th>
              <th className="px-4 py-3 text-xs text-slate-500 font-medium">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors">
                <td className="px-4 py-3">
                  <button
                    onClick={() => { setSelectedTicker(item.ticker); setActiveView("ticker"); }}
                    className="text-left hover:text-blue-400 transition-colors"
                  >
                    <div className="text-sm font-semibold text-white">{item.ticker}</div>
                    <div className="text-[10px] text-slate-500">{item.company_name}</div>
                  </button>
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm text-white">
                  {item.current_price ? `$${item.current_price.toFixed(2)}` : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <PriceChange value={item.change_pct} className="text-sm" />
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-slate-400">
                  {item.volume ? (item.volume / 1e6).toFixed(2) + "M" : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm">
                  {item.rsi_14 !== null ? (
                    <span className={
                      item.rsi_14 > 70 ? "text-red-400" :
                      item.rsi_14 < 30 ? "text-emerald-400" :
                      "text-slate-300"
                    }>{item.rsi_14.toFixed(1)}</span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm">
                  {item.ai_score !== null ? (
                    <span className={item.ai_score >= 70 ? "text-emerald-400" : item.ai_score < 40 ? "text-red-400" : "text-slate-300"}>
                      {item.ai_score.toFixed(1)}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded border border-slate-800 bg-slate-900/70 text-slate-300">
                      {item.watchlist_name || item.group_name || "UNGROUPED"}
                    </span>
                    {item.news_sentiment_label && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.news_sentiment_label === "positive" ? "bg-emerald-500/15 text-emerald-400" : item.news_sentiment_label === "negative" ? "bg-red-500/15 text-red-400" : "bg-slate-800 text-slate-400"}`}>
                        {item.news_sentiment_label}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <SignalBadge signal={item.overall_signal} />
                </td>
                <td className="px-4 py-3 max-w-xs">
                  {item.latest_news ? (
                    <div className="text-xs text-slate-400 truncate" title={item.latest_news}>
                      {item.latest_news}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-700">brak newsów</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleAutoAnalyze(item)}
                      className={`px-2 py-1 rounded text-[10px] ${item.auto_analyze === 1 ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"}`}
                    >
                      {item.auto_analyze === 1 ? "AUTO" : "MANUAL"}
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.ticker)}
                      className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-slate-600">
                  <Eye size={32} className="mx-auto mb-2 opacity-30" />
                  <div className="text-sm">Watchlista jest pusta. Dodaj pierwsze tickery do obserwacji.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {filteredItems.map((item) => (
          <div key={item.id} className="card p-3">
            <div className="flex items-start justify-between gap-3">
              <button
                onClick={() => { setSelectedTicker(item.ticker); setActiveView("ticker"); }}
                className="text-left"
              >
                <div className="text-sm font-semibold text-white">{item.ticker}</div>
                <div className="text-[11px] text-slate-500">{item.company_name}</div>
              </button>
              <SignalBadge signal={item.overall_signal} />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-slate-900/70 p-2">
                <div className="text-slate-500">Cena</div>
                <div className="mt-1 font-mono text-slate-200">{item.current_price ? `$${item.current_price.toFixed(2)}` : "—"}</div>
              </div>
              <div className="rounded-md bg-slate-900/70 p-2">
                <div className="text-slate-500">Zmiana</div>
                <div className="mt-1"><PriceChange value={item.change_pct} className="text-xs" /></div>
              </div>
              <div className="rounded-md bg-slate-900/70 p-2">
                <div className="text-slate-500">AI Score</div>
                <div className="mt-1 text-slate-200">{item.ai_score !== null ? item.ai_score.toFixed(1) : "—"}</div>
              </div>
              <div className="rounded-md bg-slate-900/70 p-2">
                <div className="text-slate-500">Grupa</div>
                <div className="mt-1 text-slate-200">{item.watchlist_name || item.group_name || "UNGROUPED"}</div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                onClick={() => toggleAutoAnalyze(item)}
                className={`px-2 py-1 rounded text-[10px] ${item.auto_analyze === 1 ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"}`}
              >
                {item.auto_analyze === 1 ? "AUTO" : "MANUAL"}
              </button>
              <button
                onClick={() => handleDelete(item.id, item.ticker)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-red-400"
              >
                <Trash2 size={12} />
                Usuń
              </button>
            </div>
          </div>
        ))}
        {filteredItems.length === 0 && (
          <div className="card p-6 text-center text-slate-600">
            <Eye size={28} className="mx-auto mb-2 opacity-30" />
            <div className="text-sm">Watchlista jest pusta. Dodaj pierwsze tickery do obserwacji.</div>
          </div>
        )}
      </div>
    </div>
  );
}
