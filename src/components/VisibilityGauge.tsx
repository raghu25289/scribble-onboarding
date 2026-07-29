"use client";

import { bandColor } from "@/lib/severity";

interface Props {
  visible: number;
  total: number;
  size?: number;
}

// A radial gauge replacing the old "4/5 queries" text: one glance tells you
// the visibility percentage and its severity color. Plain SVG, no chart lib.
export default function VisibilityGauge({ visible, total, size = 132 }: Props) {
  const pct = total > 0 ? Math.round((visible / total) * 100) : 0;
  const color = bandColor(pct);

  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-3xl font-semibold tabular-nums" style={{ color }}>
            {pct}%
          </span>
        </div>
      </div>
      <div className="mt-1.5 text-xs text-[var(--ink-45)]">
        {visible}/{total} engine checks
      </div>
    </div>
  );
}
