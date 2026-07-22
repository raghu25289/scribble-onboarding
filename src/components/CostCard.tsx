"use client";

import { aggregateQuery } from "@/lib/engineVisibility";
import type { ArpuVerdict, QueryWithDemand, QueryVisibility } from "@/lib/types";
import {
  estimateQueryLeads,
  estimateQueryLoss,
  estimateTotalLeads,
  estimateTotalLoss,
  formatAnchorPrice,
  formatMoney,
  truncateLabel,
} from "@/lib/costEstimate";
import { useCountUp } from "@/lib/useCountUp";

interface Props {
  brand: string;
  arpu: ArpuVerdict;
  queries: QueryWithDemand[];
  visibility: QueryVisibility[]; // resolved, same order as queries
}

// A visual revenue/leads-loss infographic, built in plain SVG/CSS (no chart
// library): a count-up headline number, then one bar per invisible query
// sized proportional to its own loss estimate. Only renders once every
// query's engines have resolved AND at least one query is invisible.
export default function CostCard({ brand, arpu, queries, visibility }: Props) {
  const ready = visibility.length === queries.length;

  const rows = ready
    ? visibility
        .map((qv, i) => ({ qv, demand: queries[i], agg: aggregateQuery(qv) }))
        .filter((row) => row.agg.invisible)
    : [];

  const leadsFirst = arpu.classification === "leads";
  const { lowUsd, highUsd } = estimateTotalLoss(rows, arpu);
  const { lowLeads, highLeads } = estimateTotalLeads(rows);

  // Hooks must run unconditionally on every render, so the count-up target is
  // computed above any early return below (an empty `rows` just yields 0).
  const { value: countUpValue, ref: countUpRef } = useCountUp<HTMLDivElement>(
    leadsFirst ? highLeads : highUsd
  );

  if (!ready || rows.length === 0) return null;

  const maxHigh = Math.max(...rows.map((r) => estimateQueryLoss(r.demand, arpu).highUsd), 1);

  return (
    <section
      className="fade-up rounded-2xl border p-6"
      style={{ borderColor: "rgba(255,107,107,0.3)", background: "rgba(255,107,107,0.05)" }}
    >
      <span
        className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold text-[var(--ink)]"
        style={{ background: "var(--miss)" }}
      >
        {leadsFirst ? "Leads at risk" : "Revenue at risk"}
      </span>

      <h3 className="mt-3 font-display text-xl font-semibold sm:text-2xl">
        What invisibility is costing {brand}.
      </h3>

      <div ref={countUpRef} className="mt-5">
        <div
          className="font-display text-5xl font-semibold tabular-nums sm:text-6xl"
          style={{ color: "var(--miss)" }}
        >
          {leadsFirst ? countUpValue.toLocaleString("en-US") : formatMoney(countUpValue)}
        </div>
        <div className="mt-1 text-sm text-[var(--muted)]">
          {leadsFirst ? "estimated leads lost, per month" : "estimated revenue lost, per month"}
        </div>
        <div className="mt-2 text-sm text-[var(--muted)]">
          {leadsFirst ? (
            <>
              Conservative {lowLeads.toLocaleString("en-US")} to aggressive{" "}
              {highLeads.toLocaleString("en-US")} leads/mo — worth {formatMoney(lowUsd)} to{" "}
              {formatMoney(highUsd)} in pipeline at {formatAnchorPrice(arpu)}/{arpu.transactionNoun}.
            </>
          ) : (
            <>
              Conservative {formatMoney(lowUsd)} to aggressive {formatMoney(highUsd)} per month.
            </>
          )}
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {rows.map(({ qv, demand, agg }, i) => {
          const { lowUsd: qLow, highUsd: qHigh } = estimateQueryLoss(demand, arpu);
          const { lowLeads: qLowLeads, highLeads: qHighLeads } = estimateQueryLeads(demand);
          const widthPct = Math.max(6, Math.round((qHigh / maxHigh) * 100));
          return (
            <div key={i}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium leading-snug">{truncateLabel(qv.query)}</span>
                <span className="shrink-0 text-[var(--muted)]">
                  {leadsFirst
                    ? `${qLowLeads}–${qHighLeads} leads/mo`
                    : `${formatMoney(qLow)}–${formatMoney(qHigh)}/mo`}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 w-full rounded-full bg-[var(--ink-soft)]">
                <div
                  className="h-2.5 rounded-full transition-[width]"
                  style={{ width: `${widthPct}%`, background: "var(--miss)" }}
                />
              </div>
              {agg.winners.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-[var(--muted)]">Winning:</span>
                  {agg.winners.slice(0, 3).map((w, wi) => (
                    <span
                      key={wi}
                      className="rounded-md border border-[var(--panel-line)] bg-[var(--ink-soft)] px-2 py-0.5 text-xs"
                    >
                      {w}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-5 text-xs text-[var(--muted)]">
        Estimates based on public search demand and your revenue model.
        Directional, not audited.
      </p>
    </section>
  );
}
