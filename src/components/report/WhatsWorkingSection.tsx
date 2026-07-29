"use client";

import { aggregateQuery } from "@/lib/engineVisibility";
import { useScrollReveal } from "@/lib/useScrollReveal";
import type { PillarScores, QueryVisibility, QueryWithDemand } from "@/lib/types";
import EngineChips from "@/components/EngineChips";

const PILLAR_WIN_COPY: Record<string, string> = {
  onsite: "Your site is already written in a way AI can quote directly.",
  reviews: "Real reviews are already backing you up where buyers look.",
  thirdparty: "Independent voices are already talking about you.",
};

interface Props {
  queries: QueryWithDemand[];
  visibility: QueryVisibility[];
  pillars: PillarScores | null;
}

export default function WhatsWorkingSection({ queries, visibility, pillars }: Props) {
  const { ref, inView } = useScrollReveal<HTMLElement>(0.2);

  const visibleRows = queries
    .map((q, i) => ({ query: q.text, qv: visibility[i], agg: aggregateQuery(visibility[i] ?? { query: q.text, engines: {} }) }))
    .filter((r) => r.agg.checkedCount > 0 && !r.agg.invisible);

  const winningPillars = pillars
    ? [pillars.onsite, pillars.reviews, pillars.thirdparty].filter((p) => p.score > 60)
    : [];

  const nothingYet = visibleRows.length === 0 && winningPillars.length === 0;

  return (
    <section
      ref={ref}
      className={`report-section reveal-on-scroll mx-auto max-w-3xl px-6 py-24 ${inView ? "is-visible" : ""}`}
    >
      <span
        className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold text-[var(--ink)]"
        style={{ background: "var(--win)" }}
      >
        What&apos;s working
      </span>
      <h2 className="font-display mt-3 text-2xl font-semibold sm:text-3xl">
        Where you&apos;re already winning.
      </h2>

      {nothingYet ? (
        <p className="mt-6 text-[15px] text-[var(--muted)]">
          Nothing yet. That&apos;s the opportunity.
        </p>
      ) : (
        <div className="mt-6 space-y-3">
          {visibleRows.map((row, i) => (
            <div
              key={`q-${i}`}
              className="rounded-xl border p-4"
              style={{ borderColor: "rgba(110,231,168,0.3)", background: "rgba(110,231,168,0.05)" }}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium leading-snug">{row.query}</span>
                <div className="flex shrink-0 gap-1.5">
                  <EngineChips visibility={row.qv ?? { query: row.query, engines: {} }} />
                </div>
              </div>
              <p className="mt-1.5 text-xs" style={{ color: "var(--win)" }}>
                Buyers asking this get you as the answer.
              </p>
            </div>
          ))}

          {winningPillars.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border p-4"
              style={{ borderColor: "rgba(110,231,168,0.3)", background: "rgba(110,231,168,0.05)" }}
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{p.label}</span>
                <span className="font-semibold tabular-nums">{p.score}/100</span>
              </div>
              <p className="mt-1.5 text-xs" style={{ color: "var(--win)" }}>
                {PILLAR_WIN_COPY[p.id] ?? "Already working in your favor."}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
