"use client";

const RECOMMENDATION_STYLE: Record<string, string> = {
  "Strong Buy": "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
  Buy: "text-green-300 border-green-500/30 bg-green-500/10",
  Hold: "text-amber-300 border-amber-500/30 bg-amber-500/10",
  Sell: "text-orange-300 border-orange-500/30 bg-orange-500/10",
  "Strong Sell": "text-red-300 border-red-500/30 bg-red-500/10",
};

export const RECOMMENDATION_ORDER = ["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"] as const;

export function recommendationTone(label: string) {
  if (label === "Strong Buy" || label === "Buy") return "text-emerald-300";
  if (label === "Hold") return "text-amber-300";
  if (label === "Sell") return "text-orange-300";
  if (label === "Strong Sell") return "text-red-300";
  return "text-slate-300";
}

export function recommendationStyle(label: string) {
  return RECOMMENDATION_STYLE[label] || RECOMMENDATION_STYLE.Hold;
}

export default function RecommendationBadge({ label }: { label: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] ${recommendationStyle(label)}`}>
      {label}
    </span>
  );
}
