"use client";

interface Props {
  value: number | null;
  suffix?: string;
  prefix?: string;
  className?: string;
}

export default function PriceChange({ value, suffix = "%", prefix = "", className = "" }: Props) {
  if (value === null || value === undefined) {
    return <span className="text-slate-600">—</span>;
  }
  const isPositive = value >= 0;
  const colorClass = isPositive ? "text-emerald-400" : "text-red-400";
  const sign = isPositive ? "+" : "";
  return (
    <span className={`font-mono ${colorClass} ${className}`}>
      {prefix}{sign}{value.toFixed(2)}{suffix}
    </span>
  );
}
