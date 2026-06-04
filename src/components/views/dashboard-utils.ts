export type RiskLabel = "Niskie" | "Średnie" | "Wysokie";

export interface DashboardPortfolioItem {
  purchase_price: number;
  current_price: number | null;
  ai_score: number | null;
  adx: number | null;
}

export interface DashboardRankedItem {
  ai_score: number;
  change_pct: number;
  rsi_14: number | null;
}

export function formatCurrency(value: number | null | undefined, currency = "USD"): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const symbol = currency === "EUR" ? "EUR " : currency === "PLN" ? "PLN " : currency === "GBP" ? "GBP " : "$";
  return `${symbol}${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function toRiskLabel(aiScore: number | null | undefined, adx?: number | null): RiskLabel {
  if ((aiScore ?? 0) >= 80 && (adx ?? 0) < 30) return "Niskie";
  if ((aiScore ?? 0) <= 40 || (adx ?? 0) > 35) return "Wysokie";
  return "Średnie";
}

export function riskTone(risk: string): string {
  if (risk === "Niskie") return "text-emerald-400";
  if (risk === "Wysokie") return "text-red-400";
  return "text-amber-400";
}

export function recommendationFromScore(score: number | null | undefined): string {
  const value = score ?? 0;
  if (value >= 90) return "Strong Buy";
  if (value >= 75) return "Buy";
  if (value >= 55) return "Hold";
  if (value >= 35) return "Weak";
  return "Sell";
}

export function scoreBand(score: number | null | undefined): string {
  const value = score ?? 0;
  if (value >= 90) return "Strong Buy";
  if (value >= 75) return "Buy";
  if (value >= 55) return "Hold";
  if (value >= 35) return "Weak";
  return "Sell";
}

export function formatDaysUntil(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "brak daty";
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const days = Math.ceil((timestamp - startToday.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return "po terminie";
  if (days === 0) return "dzisiaj";
  if (days === 1) return "jutro";
  return `${days} dni`;
}

export function compactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getStopLoss(item: DashboardPortfolioItem): number | null {
  const current = item.current_price || item.purchase_price;
  if (!current) return null;
  const risk = toRiskLabel(item.ai_score, item.adx);
  const multiplier = risk === "Niskie" ? 0.92 : risk === "Średnie" ? 0.89 : 0.85;
  return Number((current * multiplier).toFixed(2));
}

export function getTakeProfit(item: DashboardPortfolioItem): number | null {
  const current = item.current_price || item.purchase_price;
  if (!current) return null;
  const aiScore = item.ai_score || 0;
  const multiplier = aiScore >= 85 ? 1.12 : aiScore >= 70 ? 1.08 : 1.04;
  return Number((current * multiplier).toFixed(2));
}

export function getPotentialLabel(item: DashboardRankedItem): string {
  const upside = clamp((item.ai_score - 50) * 0.55 + (item.change_pct > 0 ? item.change_pct * 0.5 : item.change_pct * 0.2), -12, 25);
  return `${upside >= 0 ? "+" : ""}${upside.toFixed(1)}%`;
}

export function getPotentialReason(item: DashboardRankedItem): string {
  if (item.ai_score >= 85) return "wysoki score AI i potwierdzony trend";
  if ((item.rsi_14 ?? 50) < 35) return "wyprzedanie przy zachowanym trendzie";
  if ((item.change_pct ?? 0) > 2) return "momentum i przewaga sektora";
  return "stabilny układ techniczny";
}

export function getDownsideReason(item: DashboardRankedItem): string {
  if (item.ai_score < 25) return "bardzo słaby AI Score";
  if ((item.change_pct ?? 0) < -2.5) return "słabe momentum i odpływ kapitału";
  if ((item.rsi_14 ?? 50) > 70) return "wykupienie i ryzyko korekty";
  return "pogarszający się sentyment";
}

export function getEventImpactTone(event: { impact?: string | null; event_type?: string }): string {
  const impact = (event.impact || "").toLowerCase();
  const type = (event.event_type || "").toUpperCase();
  if (impact.includes("high") || impact.includes("wysoki") || ["CPI", "PPI", "NFP", "FOMC", "FED", "GDP", "UNEMPLOYMENT"].includes(type)) {
    return "border-red-700/40 bg-red-900/20 text-red-300";
  }
  if (impact.includes("medium") || impact.includes("śre")) {
    return "border-amber-700/40 bg-amber-900/20 text-amber-300";
  }
  return "border-slate-800 bg-slate-900/60 text-slate-300";
}
