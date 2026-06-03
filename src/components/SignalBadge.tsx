"use client";

const SIGNAL_CONFIG: Record<string, { label: string; className: string; bg: string }> = {
  strong_bullish: { label: "STRONG BULLISH ↑↑", className: "text-emerald-400", bg: "bg-emerald-900/30 border-emerald-700/50" },
  bullish: { label: "BULLISH ↑", className: "text-green-400", bg: "bg-green-900/30 border-green-700/50" },
  watch: { label: "WATCH →", className: "text-yellow-400", bg: "bg-yellow-900/30 border-yellow-700/50" },
  neutral: { label: "NEUTRAL —", className: "text-slate-400", bg: "bg-slate-800/50 border-slate-700/50" },
  risk: { label: "RISK ⚠", className: "text-orange-400", bg: "bg-orange-900/30 border-orange-700/50" },
  bearish: { label: "BEARISH ↓", className: "text-red-400", bg: "bg-red-900/30 border-red-700/50" },
  strong_bearish: { label: "STRONG BEARISH ↓↓", className: "text-red-500", bg: "bg-red-900/40 border-red-700/60" },
  no_data: { label: "N/A", className: "text-slate-600", bg: "bg-slate-900/50 border-slate-700/30" },
};

interface Props {
  signal: string | null;
  size?: "sm" | "md" | "lg";
  showBg?: boolean;
}

export default function SignalBadge({ signal, size = "sm", showBg = true }: Props) {
  const key = signal || "no_data";
  const config = SIGNAL_CONFIG[key] || SIGNAL_CONFIG["neutral"];

  const sizeClass = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
    lg: "text-base px-3 py-1.5",
  }[size];

  if (!showBg) {
    return (
      <span className={`font-mono font-semibold ${config.className} ${sizeClass}`}>
        {config.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded border font-mono font-semibold whitespace-nowrap ${config.className} ${config.bg} ${sizeClass}`}
    >
      {config.label}
    </span>
  );
}

export function IndividualSignal({ signal, label }: { signal: string; label: string }) {
  const colorMap: Record<string, string> = {
    bullish: "text-green-400",
    bearish: "text-red-400",
    neutral: "text-slate-400",
    no_data: "text-slate-600",
  };
  const color = colorMap[signal] || "text-slate-400";
  const icon = signal === "bullish" ? "▲" : signal === "bearish" ? "▼" : signal === "no_data" ? "—" : "●";

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0">
      <span className="text-slate-400 text-xs">{label}</span>
      <span className={`text-xs font-mono font-semibold ${color}`}>
        {icon} {signal.toUpperCase()}
      </span>
    </div>
  );
}
