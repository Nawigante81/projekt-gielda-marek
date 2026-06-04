"use client";

import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";
import { useAppStore } from "@/store/useAppStore";
import LoginForm from "@/components/LoginForm";
import Sidebar from "@/components/Sidebar";
import { Menu } from "lucide-react";
import Dashboard from "@/components/views/Dashboard";
import Portfolio from "@/components/views/Portfolio";
import Watchlist from "@/components/views/Watchlist";
import Market from "@/components/views/Market";
import Technicals from "@/components/views/Technicals";
import Scanner from "@/components/views/Scanner";
import Alerts from "@/components/views/Alerts";
import Reports from "@/components/views/Reports";
import TickerDetail from "@/components/views/TickerDetail";
import Settings from "@/components/views/Settings";
import Errors from "@/components/views/Errors";
import Chat from "@/components/views/Chat";
import News from "@/components/views/News";
import SecFilings from "@/components/views/SecFilings";
import EarningsCalendar from "@/components/views/EarningsCalendar";

export default function AppShell() {
  const { user, setUser, activeView } = useAppStore();
  const [authChecked, setAuthChecked] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setUser({ userId: data.userId, username: data.username });
        }
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, [setUser]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setUser({ userId: data.userId, username: data.username });
        } else {
          setUser(null);
        }
      })
      .catch(() => setUser(null));
  };

  const renderView = () => {
    switch (activeView) {
      case "dashboard": return <Dashboard />;
      case "portfolio": return <Portfolio />;
      case "watchlist": return <Watchlist />;
      case "market": return <Market />;
      case "technicals": return <Technicals />;
      case "scanner": return <Scanner />;
      case "news": return <News />;
      case "sec": return <SecFilings />;
      case "earnings": return <EarningsCalendar />;
      case "alerts": return <Alerts />;
      case "reports": return <Reports />;
      case "chat": return <Chat />;
      case "settings": return <Settings />;
      case "errors": return <Errors />;
      case "ticker": return <TickerDetail />;
      default: return <Dashboard />;
    }
  };

  if (!authChecked) {
    return (
      <>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1e293b",
              color: "#e2e8f0",
              border: "1px solid #334155",
              fontSize: "13px",
            },
          }}
        />
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
          Uruchamianie aplikacji...
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#1e293b",
              color: "#e2e8f0",
              border: "1px solid #334155",
              fontSize: "13px",
            },
          }}
        />
        <LoginForm />
      </>
    );
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1e293b",
            color: "#e2e8f0",
            border: "1px solid #334155",
            fontSize: "13px",
          },
        }}
      />
      <div className="relative min-h-screen overflow-hidden bg-slate-950">
        <div
          className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat opacity-50"
          style={{
            backgroundImage: "linear-gradient(rgba(2, 6, 23, 0.72), rgba(2, 6, 23, 0.86)), url('/assets/app-bg.png')",
          }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.08),transparent_35%),radial-gradient(circle_at_bottom,rgba(16,185,129,0.04),transparent_40%)]" />
        <div className="relative z-10 flex min-h-screen">
        <Sidebar
          onLogout={handleLogout}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur md:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200"
              >
                <Menu size={16} />
                Menu
              </button>
              <div className="text-right">
                <div className="text-sm font-semibold text-white">AI Stock Analyst</div>
                <div className="text-[11px] text-slate-500">{activeView}</div>
              </div>
            </div>
          </div>
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 md:p-6">
            {renderView()}
          </div>
        </main>
        </div>
      </div>
    </>
  );
}
