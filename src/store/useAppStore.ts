"use client";
import { create } from "zustand";

interface User {
  userId: number;
  username: string;
}

interface AppState {
  user: User | null;
  setUser: (user: User | null) => void;
  activeView: string;
  setActiveView: (view: string) => void;
  selectedTicker: string | null;
  setSelectedTicker: (ticker: string | null) => void;
  analysisRunning: boolean;
  setAnalysisRunning: (running: boolean) => void;
  unreadAlerts: number;
  setUnreadAlerts: (count: number) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  activeView: "dashboard",
  setActiveView: (view) => set({ activeView: view }),
  selectedTicker: null,
  setSelectedTicker: (ticker) => set({ selectedTicker: ticker }),
  analysisRunning: false,
  setAnalysisRunning: (running) => set({ analysisRunning: running }),
  unreadAlerts: 0,
  setUnreadAlerts: (count) => set({ unreadAlerts: count }),
}));
