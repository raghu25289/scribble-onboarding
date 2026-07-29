"use client";

import { useScrollReveal } from "@/lib/useScrollReveal";
import type { PillarId, ReportMove, ReportMoveImpact } from "@/lib/types";

const IMPACT_LABELS: Record<ReportMoveImpact, string> = {
  high_leverage: "High leverage",
  fast_win: "Fast win",
  compounding: "Compounding",
};

const PILLAR_LABELS: Record<PillarId, string> = {
  onsite: "Your site",
  reviews: "Review platforms",
  thirdparty: "Independent mentions",
};

export default function ThreeMovesSection({ moves }: { moves: [ReportMove, ReportMove, ReportMove] }) {
  const { ref, inView } = useScrollReveal<HTMLElement>(0.2);

  return (
    <section
      ref={ref}
      id="moves"
      className={`report-section reveal-on-scroll mx-auto max-w-3xl px-6 py-24 ${inView ? "is-visible" : ""}`}
    >
      <h2 className="font-display text-2xl font-semibold sm:text-3xl">
        Three moves that change this fastest.
      </h2>

      <div className="mt-8 space-y-4">
        {moves.map((move, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel)] p-6"
          >
            <div className="flex items-start gap-4">
              <span
                className="font-display flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-[var(--ink)]"
                style={{ background: "var(--accent)" }}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-lg font-semibold sm:text-xl">{move.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
                  {move.description}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className="rounded-md px-2 py-0.5 font-semibold text-[var(--ink)]"
                    style={{ background: "var(--accent)" }}
                  >
                    {IMPACT_LABELS[move.impact]}
                  </span>
                  <span className="text-[var(--muted)]">Fixes: {PILLAR_LABELS[move.pillar]}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
