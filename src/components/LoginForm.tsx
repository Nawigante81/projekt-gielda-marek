"use client";

import { useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import { Activity, Lock, User, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";

export default function LoginForm() {
  const { setUser } = useAppStore();
  const [username, setUsername] = useState("pytomek@o2.pl");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { toast.error("Podaj login i hasło"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser({ userId: data.userId, username: data.username });
        toast.success(`Zalogowano jako ${data.username}`);
      } else {
        toast.error(data.error || "Błąd logowania");
      }
    } catch {
      toast.error("Błąd połączenia z serwerem");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-slate-950 bg-cover bg-center bg-no-repeat p-4"
      style={{
        backgroundImage: "linear-gradient(rgba(2, 6, 23, 0.82), rgba(2, 6, 23, 0.9)), url('/ekran-logowania.png')",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600/20 rounded-2xl border border-blue-500/30 mb-4 backdrop-blur-sm">
            <Activity size={28} className="text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Analizator Giełdowy</h1>
          <p className="text-sm text-slate-300 mt-1">Panel analizy rynku i portfela</p>
        </div>

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/80 p-6 space-y-4 shadow-2xl backdrop-blur-md">
          <div className="flex flex-col items-center gap-3">
            <img
              src="/logo-aplikacji.png"
              alt="Logo Analizator Giełdowy"
              className="h-16 w-16 rounded-2xl border border-slate-700/70 object-cover shadow-lg"
            />
            <h2 className="text-sm font-medium text-slate-300 text-center">Zaloguj się</h2>
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Nazwa użytkownika</label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-md pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="pytomek@o2.pl"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">Hasło</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  className="w-full bg-slate-800/90 border border-slate-700 rounded-md pl-9 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Logowanie..." : "Zaloguj się"}
            </button>
          </form>
        </div>

        <div className="text-center mt-4 text-xs text-slate-300">
          Aplikacja prywatna • Tylko do użytku osobistego
        </div>
        <div className="text-center mt-1 text-xs text-slate-400">
          Domyślny login: pytomek@o2.pl / admin123
        </div>
      </div>
    </div>
  );
}
