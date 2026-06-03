"use client";

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Bell, CheckCheck, AlertCircle, Info, AlertTriangle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface Alert {
  id: number;
  ticker: string;
  alert_type: string;
  severity: string;
  message: string;
  value: number | null;
  threshold: number | null;
  is_read: number;
  created_at: string;
}

interface AlertRule {
  id: number;
  rule_key: string;
  name: string;
  description: string;
  is_enabled: number;
}

const SEVERITY_CONFIG = {
  critical: { icon: <AlertCircle size={14} />, color: "text-red-400", bg: "bg-red-900/20 border-red-800/50", label: "Krytyczny" },
  warning: { icon: <AlertTriangle size={14} />, color: "text-amber-400", bg: "bg-amber-900/20 border-amber-800/50", label: "Ostrzeżenie" },
  info: { icon: <Info size={14} />, color: "text-blue-400", bg: "bg-blue-900/10 border-blue-800/30", label: "Info" },
};

export default function Alerts() {
  const { setUnreadAlerts } = useAppStore();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread" | "critical" | "warning" | "info">("all");

  const fetchAlerts = useCallback(async () => {
    const [alertRes, rulesRes] = await Promise.all([
      fetch("/api/alerts?limit=100"),
      fetch("/api/alert-rules"),
    ]);

    if (alertRes.ok) {
      const data = await alertRes.json();
      setAlerts(data);
      setUnreadAlerts(data.filter((a: Alert) => !a.is_read).length);
    }
    if (rulesRes.ok) setRules(await rulesRes.json());
    setLoading(false);
  }, [setUnreadAlerts]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const markAllRead = async () => {
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    toast.success("Wszystkie alerty oznaczone jako przeczytane");
    fetchAlerts();
  };

  const markRead = async (id: number) => {
    await fetch("/api/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    fetchAlerts();
  };

  const filtered = alerts.filter(a => {
    if (filter === "unread") return !a.is_read;
    if (filter === "critical") return a.severity === "critical";
    if (filter === "warning") return a.severity === "warning";
    if (filter === "info") return a.severity === "info";
    return true;
  });

  const unreadCount = alerts.filter(a => !a.is_read).length;

  const toggleRule = async (rule: AlertRule) => {
    const res = await fetch("/api/alert-rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rule_key: rule.rule_key, is_enabled: !(rule.is_enabled === 1) }),
    });
    if (res.ok) {
      toast.success(`Reguła ${rule.name} ${rule.is_enabled === 1 ? "wyłączona" : "włączona"}`);
      fetchAlerts();
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={24} /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white flex items-center gap-2">
            <Bell size={18} className="text-blue-400" /> Alerty
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{unreadCount} nieodczytanych • {alerts.length} łącznie</p>
        </div>
        <button
          onClick={markAllRead}
          className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 text-sm rounded-md transition-colors"
        >
          <CheckCheck size={14} /> Oznacz wszystkie
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-1 bg-slate-800/50 rounded-md p-0.5 w-fit">
        {(["all", "unread", "critical", "warning", "info"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded text-xs transition-colors ${filter === f ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"}`}
          >
            {f === "all" ? "Wszystkie" :
             f === "unread" ? `Nieprzeczytane (${unreadCount})` :
             f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-medium text-white">Reguły alertów</div>
            <div className="text-xs text-slate-500">Włączaj i wyłączaj reguły wykrywania bez zatrzymywania analizy.</div>
          </div>
          <div className="text-xs text-slate-500">{rules.filter((rule) => rule.is_enabled === 1).length}/{rules.length} aktywne</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {rules.map((rule) => (
            <button
              key={rule.rule_key}
              onClick={() => toggleRule(rule)}
              className={`text-left rounded-md border px-3 py-2 transition-colors ${rule.is_enabled === 1 ? "border-emerald-700/40 bg-emerald-900/10" : "border-slate-800 bg-slate-900/60"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-white">{rule.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{rule.description}</div>
                </div>
                <span className={`text-[10px] px-2 py-1 rounded ${rule.is_enabled === 1 ? "bg-emerald-500/20 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>
                  {rule.is_enabled === 1 ? "ON" : "OFF"}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Alerts list */}
      <div className="space-y-2">
        {filtered.map((alert) => {
          const config = SEVERITY_CONFIG[alert.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.info;
          return (
            <div
              key={alert.id}
              className={`card p-3 border flex items-start gap-3 cursor-pointer transition-opacity ${alert.is_read ? "opacity-50" : ""} ${config.bg}`}
              onClick={() => !alert.is_read && markRead(alert.id)}
            >
              <span className={`mt-0.5 flex-shrink-0 ${config.color}`}>{config.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${config.bg} ${config.color}`}>
                    {config.label.toUpperCase()}
                  </span>
                  <span className="text-xs font-semibold text-white bg-slate-800 px-1.5 py-0.5 rounded">{alert.ticker}</span>
                  <span className="text-[10px] text-slate-600 font-mono">{alert.alert_type}</span>
                  {!alert.is_read && (
                    <span className="ml-auto text-[10px] text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded">NOWY</span>
                  )}
                </div>
                <div className="text-sm text-slate-300">{alert.message}</div>
                {(alert.value !== null || alert.threshold !== null) && (
                  <div className="text-[11px] text-slate-600 mt-0.5 font-mono">
                    {alert.value !== null && `Wartość: ${alert.value.toFixed(2)}`}
                    {alert.threshold !== null && ` • Próg: ${alert.threshold.toFixed(2)}`}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-slate-600 flex-shrink-0 text-right">
                {new Date(alert.created_at).toLocaleString("pl-PL", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="card p-12 text-center text-slate-600">
            <Bell size={32} className="mx-auto mb-2 opacity-30" />
            <div className="text-sm">Brak alertów w tej kategorii</div>
          </div>
        )}
      </div>
    </div>
  );
}
