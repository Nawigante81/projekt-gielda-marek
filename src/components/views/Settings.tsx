"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings as SettingsIcon, Save, Loader2, Eye, EyeOff, Database } from "lucide-react";
import toast from "react-hot-toast";

interface SettingsData {
  finnhub_api_key: string | boolean;
  alphavantage_api_key: string | boolean;
  openai_api_key: string | boolean;
  openai_base_url: string;
  telegram_bot_token: string | boolean;
  telegram_chat_id: string;
  smtp_host: string;
  smtp_port: string;
  smtp_user: string;
  smtp_password: string;
  rsi_overbought: string;
  rsi_oversold: string;
  volume_spike_threshold: string;
  price_move_threshold: string;
  data_source_primary: string;
  notifications_telegram: string;
  notifications_email: string;
  notifications_webhook: string;
  webhook_url: string;
  mode: string;
  _env_overrides: Record<string, boolean | string>;
  [key: string]: string | boolean | Record<string, boolean | string>;
}

export default function Settings() {
  const [settings, setSettings] = useState<Partial<SettingsData>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);

  const fetchSettings = useCallback(async () => {
    const res = await fetch("/api/settings");
    if (res.ok) setSettings(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (res.ok) {
      toast.success("Ustawienia zapisane");
      fetchSettings();
    } else {
      toast.error("Błąd zapisu");
    }
    setSaving(false);
  };

  const changePassword = async () => {
    if (!currentPassword || !newPassword) { toast.error("Wypełnij oba pola"); return; }
    setChangingPwd(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success("Hasło zmienione");
      setCurrentPassword("");
      setNewPassword("");
    } else {
      toast.error(data.error || "Błąd zmiany hasła");
    }
    setChangingPwd(false);
  };

  const loadSeed = async () => {
    if (!confirm("Załadować dane testowe? Usunie obecne portfolio i watchlistę.")) return;
    setSeedLoading(true);
    const res = await fetch("/api/seed", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      toast.success(data.message || "Dane seed załadowane");
    } else {
      toast.error(data.error || "Błąd seed");
    }
    setSeedLoading(false);
  };

  const set = (key: string, value: string) => setSettings(s => ({ ...s, [key]: value }));

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-blue-500" size={24} /></div>;
  }

  const envOverrides = settings._env_overrides as Record<string, boolean | string> || {};

  const InputField = ({ label, settingKey, placeholder, type = "text", isPassword = false }: {
    label: string; settingKey: string; placeholder?: string; type?: string; isPassword?: boolean;
  }) => {
    const isEnvSet = envOverrides[settingKey] === true;
    return (
      <div>
        <label className="block text-xs text-slate-400 mb-1 flex items-center gap-2">
          {label}
          {isEnvSet && <span className="text-[10px] text-emerald-500 bg-emerald-900/20 px-1.5 py-0.5 rounded">z .env</span>}
        </label>
        <input
          type={isPassword && !showKeys ? "password" : type}
          disabled={isEnvSet}
          className={`w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors ${
            isEnvSet ? "text-slate-600 cursor-not-allowed" : "text-white"
          }`}
          placeholder={isEnvSet ? "Ustawione przez zmienną środowiskową" : placeholder}
          value={isEnvSet ? "" : String(settings[settingKey] || "")}
          onChange={e => !isEnvSet && set(settingKey, e.target.value)}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <SettingsIcon size={18} className="text-blue-400" /> Ustawienia
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowKeys(!showKeys)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 text-sm rounded-md transition-colors"
          >
            {showKeys ? <EyeOff size={14} /> : <Eye size={14} />}
            {showKeys ? "Ukryj klucze" : "Pokaż klucze"}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors disabled:opacity-50"
          >
            <Save size={14} /> {saving ? "Zapisuję..." : "Zapisz"}
          </button>
        </div>
      </div>

      {/* API Keys */}
      <div className="card p-4 space-y-4">
        <h2 className="text-sm font-medium text-slate-300 border-b border-slate-800 pb-2">Klucze API</h2>
        <div className="text-xs text-slate-500 bg-slate-800/50 rounded p-3">
          ⚠ Klucze API można też ustawić w pliku <code className="text-slate-300">.env</code>. Klucze z .env mają pierwszeństwo.
        </div>
        <div className="grid grid-cols-2 gap-3">
          <InputField label="Finnhub API Key" settingKey="finnhub_api_key" placeholder="Darmowy klucz z finnhub.io" isPassword />
          <InputField label="Alpha Vantage API Key" settingKey="alphavantage_api_key" placeholder="Darmowy klucz z alphavantage.co" isPassword />
          <InputField label="OpenAI API Key" settingKey="openai_api_key" placeholder="sk-..." isPassword />
          <InputField label="OpenAI Base URL" settingKey="openai_base_url" placeholder="https://api.openai.com/v1" />
        </div>
      </div>

      {/* Notifications */}
      <div className="card p-4 space-y-4">
        <h2 className="text-sm font-medium text-slate-300 border-b border-slate-800 pb-2">Powiadomienia</h2>

        <div>
          <h3 className="text-xs font-medium text-slate-400 mb-3">Telegram</h3>
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Bot Token" settingKey="telegram_bot_token" placeholder="123456:ABC..." isPassword />
            <InputField label="Chat ID" settingKey="telegram_chat_id" placeholder="-100123456789" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="tg-enabled"
              checked={settings.notifications_telegram === "1"}
              onChange={e => set("notifications_telegram", e.target.checked ? "1" : "0")}
              className="w-4 h-4 accent-blue-500"
            />
            <label htmlFor="tg-enabled" className="text-xs text-slate-400">Włącz powiadomienia Telegram</label>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-medium text-slate-400 mb-3">Webhook</h3>
          <InputField label="Webhook URL" settingKey="webhook_url" placeholder="https://hooks.example.com/..." />
          <div className="mt-2 flex items-center gap-2">
            <input
              type="checkbox"
              id="wh-enabled"
              checked={settings.notifications_webhook === "1"}
              onChange={e => set("notifications_webhook", e.target.checked ? "1" : "0")}
              className="w-4 h-4 accent-blue-500"
            />
            <label htmlFor="wh-enabled" className="text-xs text-slate-400">Włącz powiadomienia Webhook</label>
          </div>
        </div>
      </div>

      {/* Analysis Thresholds */}
      <div className="card p-4 space-y-4">
        <h2 className="text-sm font-medium text-slate-300 border-b border-slate-800 pb-2">Progi alertów</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">RSI - wykupienie</label>
            <input
              type="number" min="50" max="100"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              value={String(settings.rsi_overbought || "70")}
              onChange={e => set("rsi_overbought", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">RSI - wyprzedanie</label>
            <input
              type="number" min="0" max="50"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              value={String(settings.rsi_oversold || "30")}
              onChange={e => set("rsi_oversold", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Próg wolumenu (%)</label>
            <input
              type="number" min="100" max="500"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              value={String(settings.volume_spike_threshold || "150")}
              onChange={e => set("volume_spike_threshold", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Próg ruchu ceny (%)</label>
            <input
              type="number" min="1" max="50"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              value={String(settings.price_move_threshold || "5")}
              onChange={e => set("price_move_threshold", e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Data Source */}
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-medium text-slate-300 border-b border-slate-800 pb-2">Źródła danych</h2>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Główne źródło danych</label>
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            value={String(settings.data_source_primary || "finnhub")}
            onChange={e => set("data_source_primary", e.target.value)}
          >
            <option value="finnhub">Finnhub (darmowy)</option>
            <option value="alphavantage">Alpha Vantage (darmowy)</option>
            <option value="yahoo">Yahoo Finance (darmowy, bez klucza)</option>
          </select>
        </div>
        <div className="text-xs text-slate-600">
          Fallback: Finnhub → Alpha Vantage → Yahoo Finance
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Tryb aplikacji</label>
          <select
            className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            value={String(settings.mode || "test")}
            onChange={e => set("mode", e.target.value)}
          >
            <option value="test">Test (ograniczone API calls)</option>
            <option value="production">Produkcja</option>
          </select>
        </div>
      </div>

      {/* Security */}
      <div className="card p-4 space-y-4">
        <h2 className="text-sm font-medium text-slate-300 border-b border-slate-800 pb-2">Bezpieczeństwo</h2>
        <div>
          <h3 className="text-xs font-medium text-slate-400 mb-3">Zmiana hasła</h3>
          <div className="space-y-2">
            <input
              type="password"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              placeholder="Aktualne hasło"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
            />
            <input
              type="password"
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
              placeholder="Nowe hasło (min. 6 znaków)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
            <button
              onClick={changePassword}
              disabled={changingPwd}
              className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded transition-colors disabled:opacity-50"
            >
              {changingPwd ? "Zmieniam..." : "Zmień hasło"}
            </button>
          </div>
        </div>
      </div>

      {/* Seed Data */}
      {process.env.NODE_ENV !== "production" && (
        <div className="card p-4">
          <h2 className="text-sm font-medium text-slate-300 border-b border-slate-800 pb-2 mb-4">Dane testowe</h2>
          <button
            onClick={loadSeed}
            disabled={seedLoading}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-md transition-colors disabled:opacity-50"
          >
            <Database size={14} />
            {seedLoading ? "Ładuję..." : "Załaduj dane seed (login: pytomek@o2.pl / admin123)"}
          </button>
          <div className="text-xs text-slate-600 mt-2">
            Załaduje przykładowe portfolio, watchlistę i alerty. Ustawi konto pytomek@o2.pl z hasłem admin123.
          </div>
        </div>
      )}

      <div className="text-xs text-slate-700 text-center pb-4">
        AI Stock Analyst v1.0 • Dane tylko informacyjne • Nie stanowi porady inwestycyjnej
      </div>
    </div>
  );
}
