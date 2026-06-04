"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Plus, Edit2, Trash2, X, TrendingUp, Loader2 } from "lucide-react";
import SignalBadge from "@/components/SignalBadge";
import PriceChange from "@/components/PriceChange";
import TrendLabel from "@/components/TrendLabel";
import toast from "react-hot-toast";

interface PortfolioItem {
  id: number;
  ticker: string;
  company_name: string;
  shares: number;
  purchase_price: number;
  purchase_date: string;
  currency: "USD" | "EUR" | "PLN" | "GBP";
  alert_threshold: number | null;
  status: "observed" | "owned" | "sold";
  notes: string;
  current_price: number | null;
  change_pct: number | null;
  change_abs: number | null;
  volume: number | null;
  overall_signal: string | null;
  rsi_14: number | null;
  macd_histogram: number | null;
  last_updated: string | null;
}

interface FormData {
  ticker: string;
  company_name: string;
  shares: string;
  purchase_price: string;
  purchase_date: string;
  currency: "USD" | "EUR" | "PLN" | "GBP";
  alert_threshold: string;
  status: "observed" | "owned" | "sold";
  notes: string;
}

const emptyForm: FormData = {
  ticker: "", company_name: "", shares: "", purchase_price: "",
  purchase_date: new Date().toISOString().split("T")[0],
  currency: "USD",
  alert_threshold: "",
  status: "owned",
  notes: "",
};

const statusLabels: Record<PortfolioItem["status"], string> = {
  observed: "Obserwowane",
  owned: "Posiadane",
  sold: "Sprzedane",
};

const currencySymbols: Record<PortfolioItem["currency"], string> = {
  USD: "$",
  EUR: "€",
  PLN: "zł",
  GBP: "£",
};

export default function Portfolio() {
  const { setSelectedTicker, setActiveView } = useAppStore();
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<PortfolioItem | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchPortfolio = useCallback(async () => {
    const res = await fetch("/api/portfolio");
    if (res.ok) {
      const data = await res.json();
      setItems(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPortfolio(); }, [fetchPortfolio]);

  const openAdd = () => { setForm(emptyForm); setEditItem(null); setShowForm(true); };
  const openEdit = (item: PortfolioItem) => {
    setForm({
      ticker: item.ticker,
      company_name: item.company_name || "",
      shares: String(item.shares),
      purchase_price: String(item.purchase_price),
      purchase_date: item.purchase_date || "",
      currency: item.currency || "USD",
      alert_threshold: item.alert_threshold ? String(item.alert_threshold) : "",
      status: item.status || "owned",
      notes: item.notes || "",
    });
    setEditItem(item);
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!form.ticker || !form.shares || !form.purchase_price) {
      toast.error("Wypełnij wymagane pola");
      return;
    }
    setSubmitting(true);
    try {
      const url = editItem ? `/api/portfolio/${editItem.id}` : "/api/portfolio";
      const method = editItem ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: form.ticker.toUpperCase(),
          company_name: form.company_name,
          shares: parseFloat(form.shares),
          purchase_price: parseFloat(form.purchase_price),
          purchase_date: form.purchase_date,
          currency: form.currency,
          alert_threshold: form.alert_threshold ? parseFloat(form.alert_threshold) : null,
          status: form.status,
          notes: form.notes,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(editItem ? "Pozycja zaktualizowana" : "Pozycja dodana");
        setShowForm(false);
        fetchPortfolio();
      } else {
        toast.error(data.error || "Błąd operacji");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number, ticker: string) => {
    if (!confirm(`Usunąć pozycję ${ticker} z portfolio?`)) return;
    const res = await fetch(`/api/portfolio/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(`${ticker} usunięty z portfolio`);
      fetchPortfolio();
    }
  };

  const activeItems = items.filter((item) => item.status !== "sold");
  const totalValue = activeItems.reduce((s, i) => s + (i.current_price || i.purchase_price) * i.shares, 0);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={24} /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-400" /> Portfolio
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{items.length} pozycji • Aktywna wartość: ${totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
        >
          <Plus size={14} /> Dodaj pozycję
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="card p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-white">{editItem ? "Edytuj pozycję" : "Dodaj pozycję"}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Ticker *</label>
                  <input
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 uppercase"
                    placeholder="AAPL"
                    value={form.ticker}
                    onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                    disabled={!!editItem}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Nazwa spółki</label>
                  <input
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    placeholder="Apple Inc."
                    value={form.company_name}
                    onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Ilość akcji *</label>
                  <input
                    type="number" step="0.01" min="0"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    placeholder="10"
                    value={form.shares}
                    onChange={e => setForm(f => ({ ...f, shares: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Cena zakupu *</label>
                  <input
                    type="number" step="0.01" min="0"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    placeholder="150.00"
                    value={form.purchase_price}
                    onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Waluta</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    value={form.currency}
                    onChange={e => setForm(f => ({ ...f, currency: e.target.value as FormData["currency"] }))}
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="PLN">PLN</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Próg alertu</label>
                  <input
                    type="number" step="0.01" min="0"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
                    placeholder="180.00"
                    value={form.alert_threshold}
                    onChange={e => setForm(f => ({ ...f, alert_threshold: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Status</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    value={form.status}
                    onChange={e => setForm(f => ({ ...f, status: e.target.value as FormData["status"] }))}
                  >
                    <option value="observed">Obserwowane</option>
                    <option value="owned">Posiadane</option>
                    <option value="sold">Sprzedane</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Data zakupu</label>
                <input
                  type="date"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  value={form.purchase_date}
                  onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Notatki</label>
                <textarea
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Opcjonalne notatki..."
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {submitting ? "Zapisuję..." : editItem ? "Zapisz zmiany" : "Dodaj"}
                </button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded text-sm transition-colors">
                  Anuluj
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Ticker</th>
              <th className="text-left px-4 py-3 text-xs text-slate-500 font-medium">Status</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Akcje</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Cena zakupu</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Cena aktualna</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Zmiana dnia</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">P&L</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Wartość</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">Sygnał</th>
              <th className="text-right px-4 py-3 text-xs text-slate-500 font-medium">RSI</th>
              <th className="px-4 py-3 text-xs text-slate-500 font-medium">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const currentPrice = item.current_price || item.purchase_price;
              const posValue = currentPrice * item.shares;
              const pnl = (currentPrice - item.purchase_price) * item.shares;
              const pnlPct = ((currentPrice - item.purchase_price) / item.purchase_price) * 100;
              const portShare = totalValue > 0 ? (posValue / totalValue) * 100 : 0;
              const currencySymbol = currencySymbols[item.currency] || item.currency;

              return (
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
                  <td className="px-4 py-3">
                    <div className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] ${
                      item.status === "owned" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                      item.status === "sold" ? "border-slate-600 bg-slate-800 text-slate-400" :
                      "border-blue-500/30 bg-blue-500/10 text-blue-400"
                    }`}>
                      {statusLabels[item.status] || item.status}
                    </div>
                    {item.alert_threshold ? (
                      <div className="mt-1 text-[10px] text-amber-400">Alert: {currencySymbol}{item.alert_threshold.toFixed(2)}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-slate-300">{item.shares}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-slate-400">{currencySymbol}{item.purchase_price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-white">
                    {item.current_price ? `${currencySymbol}${item.current_price.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <PriceChange value={item.change_pct} className="text-xs" />
                    <TrendLabel delta={item.change_pct} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className={`font-mono text-sm ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {pnl >= 0 ? "+" : ""}{currencySymbol}{Math.abs(pnl).toFixed(2)}
                    </div>
                    <div className={`text-[10px] ${pnlPct >= 0 ? "text-emerald-500" : "text-red-500"}`}>
                      {pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="font-mono text-sm text-slate-300">{currencySymbol}{posValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="text-[10px] text-slate-600">{portShare.toFixed(1)}% portfela</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <SignalBadge signal={item.overall_signal} />
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">
                    {item.rsi_14 ? (
                      <span className={
                        item.rsi_14 > 70 ? "text-red-400" :
                        item.rsi_14 < 30 ? "text-emerald-400" :
                        "text-slate-300"
                      }>{item.rsi_14.toFixed(1)}</span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(item)} className="p-1 text-slate-600 hover:text-blue-400 transition-colors">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => handleDelete(item.id, item.ticker)} className="p-1 text-slate-600 hover:text-red-400 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-slate-600">
                  <TrendingUp size={32} className="mx-auto mb-2 opacity-30" />
                  <div className="text-sm">Portfolio jest puste. Dodaj pierwszą pozycję.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
