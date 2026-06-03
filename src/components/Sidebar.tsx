"use client";

import { useAppStore } from "@/store/useAppStore";
import {
  LayoutDashboard,
  TrendingUp,
  Eye,
  BarChart2,
  Bell,
  FileText,
  Search,
  Settings,
  LogOut,
  Activity,
  AlertTriangle,
  MessagesSquare,
  X,
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={16} /> },
  { id: "portfolio", label: "Portfolio", icon: <TrendingUp size={16} /> },
  { id: "watchlist", label: "Watchlista", icon: <Eye size={16} /> },
  { id: "market", label: "Rynek / Indeksy", icon: <BarChart2 size={16} /> },
  { id: "technicals", label: "Sygnały", icon: <Activity size={16} /> },
  { id: "scanner", label: "Skaner okazji", icon: <Search size={16} /> },
  { id: "chat", label: "AI Chat", icon: <MessagesSquare size={16} /> },
  { id: "alerts", label: "Alerty", icon: <Bell size={16} /> },
  { id: "reports", label: "Raporty AI", icon: <FileText size={16} /> },
  { id: "errors", label: "Błędy danych", icon: <AlertTriangle size={16} /> },
  { id: "settings", label: "Ustawienia", icon: <Settings size={16} /> },
];

interface Props {
  onLogout: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ onLogout, mobileOpen = false, onCloseMobile }: Props) {
  const { activeView, setActiveView, unreadAlerts, user } = useAppStore();
  const containerClassName = `
    w-72 md:w-64 min-h-screen flex flex-col border-r border-slate-800 bg-slate-900/95 md:bg-slate-900/50
  `;

  return (
    <>
      <aside className={`${containerClassName} hidden md:flex`}>
        {/* Logo */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
              <Activity size={14} className="text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">AI Stock Analyst</div>
              <div className="text-[10px] text-slate-500">US Market Monitor</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-sm transition-colors ${
                activeView === item.id
                  ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
              }`}
            >
              <span className={activeView === item.id ? "text-blue-400" : "text-slate-500"}>
                {item.icon}
              </span>
              {item.label}
              {item.id === "alerts" && unreadAlerts > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadAlerts > 99 ? "99+" : unreadAlerts}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-slate-800">
          <div className="px-3 py-2 text-[11px] text-slate-600 mb-1">
            Zalogowany: <span className="text-slate-400">{user?.username}</span>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-red-400 hover:bg-red-900/10 transition-colors"
          >
            <LogOut size={14} />
            Wyloguj
          </button>
        </div>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Zamknij menu"
            className="absolute inset-0 bg-black/60"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 flex h-full w-[86vw] max-w-sm flex-col border-r border-slate-800 bg-slate-950 shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                  <Activity size={14} className="text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">AI Stock Analyst</div>
                  <div className="text-[10px] text-slate-500">US Market Monitor</div>
                </div>
              </div>
              <button
                type="button"
                className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
                onClick={onCloseMobile}
                aria-label="Zamknij menu"
              >
                <X size={18} />
              </button>
            </div>

            <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveView(item.id);
                    onCloseMobile?.();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-left text-sm transition-colors ${
                    activeView === item.id
                      ? "bg-blue-600/20 text-blue-400 border border-blue-600/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                >
                  <span className={activeView === item.id ? "text-blue-400" : "text-slate-500"}>
                    {item.icon}
                  </span>
                  {item.label}
                  {item.id === "alerts" && unreadAlerts > 0 && (
                    <span className="ml-auto bg-red-600 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                      {unreadAlerts > 99 ? "99+" : unreadAlerts}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="p-2 border-t border-slate-800">
              <div className="px-3 py-2 text-[11px] text-slate-600 mb-1">
                Zalogowany: <span className="text-slate-400">{user?.username}</span>
              </div>
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-red-400 hover:bg-red-900/10 transition-colors"
              >
                <LogOut size={14} />
                Wyloguj
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
