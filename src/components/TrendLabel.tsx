"use client";

type TrendLabelProps = {
  delta?: number | null;
  signal?: string | null;
};

function trendFromSignal(signal?: string | null) {
  if (!signal) return null;
  const normalized = signal.toLowerCase();
  if (normalized.includes("strong_buy") || normalized.includes("buy") || normalized.includes("bull")) {
    return "up";
  }
  if (normalized.includes("strong_sell") || normalized.includes("sell") || normalized.includes("bear")) {
    return "down";
  }
  return "neutral";
}

export default function TrendLabel({ delta, signal }: TrendLabelProps) {
  const derivedTrend = trendFromSignal(signal);
  const effectiveTrend =
    derivedTrend ??
    (delta === null || delta === undefined || Number.isNaN(delta)
      ? "neutral"
      : delta > 0
        ? "up"
        : delta < 0
          ? "down"
          : "neutral");

  if (effectiveTrend === "up") {
    return <div className="text-[10px] uppercase tracking-[0.18em] text-emerald-400">trend up</div>;
  }

  if (effectiveTrend === "down") {
    return <div className="text-[10px] uppercase tracking-[0.18em] text-red-400">trend down</div>;
  }

  return <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">trend neutral</div>;
}
