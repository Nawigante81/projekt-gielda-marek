"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Trash2, RefreshCw, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface FetchError {
  id: number;
  ticker: string | null;
  source: string;
  error_type: string;
  message: string;
  created_at: string;
}

export default function Errors() {
  const [errors, setErrors] = useState<FetchError[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchErrors = useCallback(async () => {
    const res = await fetch("/api/errors");
    if (res.ok) setErrors(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchErrors(); }, [fetchErrors]);

  const clearErrors = async () => {
    if (!confirm("Wyczyścić historię błędów?")) return;
    await fetch("/api/errors", { method: "DELETE" });
    toast.success("Historia błędów wyczyszczona");
    setErrors([]);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={24} /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-400" /> Błędy pobierania danych
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={fetchErrors} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors">
            <RefreshCw size={14} />
          </button>
          {errors.length > 0 && (
            <button
              onClick={clearErrors}
              className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/10 text-sm rounded-md transition-colors"
            >
              <Trash2 size={14} /> Wyczyść
            </button>
          )}
        </div>
      </div>

      {errors.length > 0 ? (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="text-left px-4 py-3 text-xs text-slate-500">Ticker</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500">Źródło</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500">Typ błędu</th>
                <th className="text-left px-4 py-3 text-xs text-slate-500">Komunikat</th>
                <th className="text-right px-4 py-3 text-xs text-slate-500">Czas</th>
              </tr>
            </thead>
            <tbody>
              {errors.map((error) => (
                <tr key={error.id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                  <td className="px-4 py-2.5">
                    <span className="text-sm font-mono text-slate-300">{error.ticker || "—"}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                      error.source === "finnhub" ? "bg-blue-900/30 text-blue-400" :
                      error.source === "alphavantage" ? "bg-purple-900/30 text-purple-400" :
                      error.source === "yahoo" ? "bg-amber-900/30 text-amber-400" :
                      "bg-slate-800 text-slate-400"
                    }`}>
                      {error.source}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400 font-mono">{error.error_type}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">{error.message}</td>
                  <td className="px-4 py-2.5 text-right text-xs text-slate-600 font-mono">
                    {new Date(error.created_at).toLocaleString("pl-PL", {
                      month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit"
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-12 text-center text-slate-600">
          <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
          <div className="text-sm">Brak błędów. Wszystkie źródła danych działają poprawnie.</div>
        </div>
      )}
    </div>
  );
}
