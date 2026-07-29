"use client";

import { useScrollReveal } from "@/lib/useScrollReveal";
import { bandColor } from "@/lib/severity";

interface Props {
  category: string;
  headlineScorePct: number;
  benchmark: { leaderPct: number; medianPct: number };
}

const BARS = (headlineScorePct: number, benchmark: Props["benchmark"]) => [
  { label: "Category leaders", pct: benchmark.leaderPct, color: "var(--win)", delayMs: 0 },
  { label: "Category median", pct: benchmark.medianPct, color: "var(--amber)", delayMs: 150 },
  { label: "You", pct: headlineScorePct, color: bandColor(headlineScorePct), delayMs: 300 },
];

export default function IndustryStandardSection({ category, headlineScorePct, benchmark }: Props) {
  const { ref, inView } = useScrollReveal<HTMLElement>(0.25);
  const bars = BARS(headlineScorePct, benchmark);

  return (
    <section
      ref={ref}
      className={`report-section reveal-on-scroll mx-auto max-w-3xl px-6 py-24 ${inView ? "is-visible" : ""}`}
    >
      <h2 className="font-display text-2xl font-semibold sm:text-3xl">
        What good looks like in {category}.
      </h2>

      <div className="mt-8 space-y-6">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{bar.label}</span>
              <span className="font-semibold tabular-nums" style={{ color: bar.color }}>
                {bar.pct}%
              </span>
            </div>
            <div className="relative mt-1.5 h-3 w-full rounded-full bg-[var(--ink-soft)]">
              <div
                className="bar-fill absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: inView ? `${Math.max(2, bar.pct)}%` : "0%",
                  background: bar.color,
                  transitionDelay: `${bar.delayMs}ms`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs leading-relaxed text-[var(--muted)]">
        Benchmark estimated from category competitive analysis. Directional.
      </p>
    </section>
  );
}
