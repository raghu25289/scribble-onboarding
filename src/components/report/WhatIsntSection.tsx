"use client";

import { aggregateQuery, competitorWinCounts } from "@/lib/engineVisibility";
import { useScrollReveal } from "@/lib/useScrollReveal";
import {
  computeCostBreakdown,
  formatMoney,
  round2SigFigs,
  roundLeadCount,
  tierLabel,
  truncateLabel,
} from "@/lib/costEstimate";
import type { ArpuVerdict, QueryVisibility, QueryWithDemand } from "@/lib/types";
import EngineChips from "@/components/EngineChips";

const RECOVERABLE_SHARE = 0.6;

interface Props {
  queries: QueryWithDemand[];
  visibility: QueryVisibility[];
  arpu: ArpuVerdict | null;
}

export default function WhatIsntSection({ queries, visibility, arpu }: Props) {
  const { ref, inView } = useScrollReveal<HTMLElement>(0.15);

  const rows = queries
    .map((q, i) => ({
      demand: q,
      qv: visibility[i] ?? { query: q.text, engines: {} },
      agg: aggregateQuery(visibility[i] ?? { query: q.text, engines: {} }),
    }))
    .filter((r) => r.agg.checkedCount > 0 && r.agg.invisible);

  const competitors = competitorWinCounts(rows.map((r) => ({ winners: r.agg.winners })))
    .slice(0, 10)
    .map((c) => c.name);

  const pricingUnknown = arpu?.classification === "unknown_pricing";
  const leadsFirst = arpu ? arpu.classification === "leads" || pricingUnknown : false;
  const breakdown = arpu ? computeCostBreakdown(rows, arpu) : null;
  const barValue = (r: NonNullable<typeof breakdown>["rows"][number]) =>
    pricingUnknown ? r.lowLeads : r.lowUsd;
  const sortedRows = breakdown ? breakdown.rows.slice().sort((a, b) => barValue(b) - barValue(a)) : [];
  const maxBarValue = Math.max(...sortedRows.map(barValue), 1);

  if (rows.length === 0) return null;

  return (
    <section
      ref={ref}
      id="matrix"
      className={`report-section reveal-on-scroll mx-auto max-w-3xl px-6 py-24 ${inView ? "is-visible" : ""}`}
    >
      <span
        className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold text-[var(--ink)]"
        style={{ background: "var(--miss)" }}
      >
        What isn&apos;t
      </span>
      <h2 className="font-display mt-3 text-2xl font-semibold sm:text-3xl">
        Where buyers can&apos;t find you.
      </h2>

      {breakdown && (
        <div className="pulse-number mt-6">
          <div className="font-display text-5xl font-semibold tabular-nums sm:text-6xl" style={{ color: "var(--miss)" }}>
            {leadsFirst
              ? breakdown.totalLowLeads.toLocaleString("en-US")
              : formatMoney(breakdown.totalLowUsd)}
          </div>
          <div className="mt-1 text-sm text-[var(--muted)]">
            {leadsFirst ? "estimated leads lost, per month" : "estimated revenue lost, per month"}
          </div>
        </div>
      )}

      <div className="mt-8 space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel)] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium leading-snug">{row.demand.text}</span>
              <div className="flex shrink-0 gap-1.5">
                <EngineChips visibility={row.qv} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {breakdown && sortedRows.length > 0 && (
        <div id="loss-bars" className="mt-8 space-y-4">
          {sortedRows.map((row, i) => {
            const widthPct = Math.max(6, Math.round((barValue(row) / maxBarValue) * 100));
            const recoverablePct = widthPct * RECOVERABLE_SHARE;
            return (
              <div key={i}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium leading-snug">
                    {truncateLabel(row.demand.text)}{" "}
                    <span className="text-[11px] italic text-[var(--muted)]">{tierLabel(row.tier)}</span>
                  </span>
                  <span className="shrink-0 text-[var(--muted)]">
                    {leadsFirst
                      ? `${row.lowLeads.toLocaleString("en-US")}–${row.highLeads.toLocaleString("en-US")} leads/mo`
                      : `${formatMoney(row.lowUsd)}–${formatMoney(row.highUsd)}/mo`}
                  </span>
                </div>
                <div className="relative mt-1.5 h-2.5 w-full rounded-full bg-[var(--ink-soft)]">
                  <div
                    className="bar-fill absolute inset-y-0 left-0 rounded-full"
                    style={{ width: inView ? `${widthPct}%` : "0%", background: "var(--miss)" }}
                  />
                  <div
                    className="bar-fill absolute inset-y-0 left-0 rounded-full"
                    style={{ width: inView ? `${recoverablePct}%` : "0%", background: "rgba(110,231,168,0.55)" }}
                  />
                </div>
              </div>
            );
          })}

          <div className="flex items-center gap-4 text-xs text-[var(--muted)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "var(--miss)" }} />
              Lost today
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: "rgba(110,231,168,0.7)" }} />
              Recoverable
            </span>
          </div>
          <p className="text-sm font-medium" style={{ color: "var(--win)" }}>
            Estimated{" "}
            {leadsFirst
              ? `${roundLeadCount(breakdown.totalLowLeads * RECOVERABLE_SHARE).toLocaleString("en-US")} leads/mo`
              : `${formatMoney(round2SigFigs(breakdown.totalLowUsd * RECOVERABLE_SHARE))} per month`}{" "}
            recoverable.
          </p>
        </div>
      )}

      {!breakdown && (
        <p className="mt-6 text-sm text-[var(--muted)]">
          Revenue impact couldn&apos;t be estimated for this brand, but the invisibility above is real.
        </p>
      )}

      {competitors.length > 0 && (
        <div className="mt-8">
          <p className="mb-3 text-sm text-[var(--muted)]">Who AI recommends instead:</p>
          <div className="flex flex-wrap gap-2">
            {competitors.map((name, i) => (
              <span
                key={name}
                className={`chip-stagger rounded-md border border-[var(--panel-line)] bg-[var(--ink-soft)] px-2.5 py-1 text-xs ${inView ? "is-visible" : ""}`}
                style={{ transitionDelay: `${i * 80}ms`, animationDelay: `${i * 80}ms` }}
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
