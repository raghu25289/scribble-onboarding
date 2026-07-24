"use client";

import { useState } from "react";
import { aggregateQuery } from "@/lib/engineVisibility";
import type { ArpuVerdict, QueryWithDemand, QueryVisibility } from "@/lib/types";
import {
  computeCostBreakdown,
  formatAnchorPrice,
  formatMoney,
  round2SigFigs,
  tierLabel,
  truncateLabel,
} from "@/lib/costEstimate";
import { useCountUp } from "@/lib/useCountUp";

interface Props {
  brand: string;
  arpu: ArpuVerdict;
  queries: QueryWithDemand[];
  visibility: QueryVisibility[]; // resolved, same order as queries
}

// Share of each query's conservative loss framed as recoverable "with
// Scribble" — illustrative, not a guarantee (see the projection-layer note).
const RECOVERABLE_SHARE = 0.6;

// A visual revenue/leads-loss infographic, built in plain SVG/CSS (no chart
// library): a count-up headline number (the conservative estimate), then one
// bar per invisible query, longest = 100%, all scaled to the same
// (conservative) figure. Only renders once every query's engines have
// resolved AND at least one query is invisible.
export default function CostCard({ brand, arpu, queries, visibility }: Props) {
  const [showMethod, setShowMethod] = useState(false);
  const ready = visibility.length === queries.length;

  const rows = ready
    ? visibility
        .map((qv, i) => ({ qv, demand: queries[i], agg: aggregateQuery(qv) }))
        .filter((row) => row.agg.invisible)
    : [];

  // No pricing signal exists at all — the cost card can't convert demand into
  // dollars honestly, so it drops to a leads-only framing with zero $ figures
  // anywhere (headline, bars, and the recoverable line all follow this).
  const pricingUnknown = arpu.classification === "unknown_pricing";
  const leadsFirst = arpu.classification === "leads" || pricingUnknown;
  const breakdown = computeCostBreakdown(rows, arpu);
  // Bars are proportional to whichever figure is actually being shown
  // (leads when pricing is unknown — the $ side is meaningless there since
  // price defaults to 0 — dollars otherwise), longest = 100%, sorted
  // descending so the biggest gap reads first.
  const barValue = (r: (typeof breakdown.rows)[number]) => (pricingUnknown ? r.lowLeads : r.lowUsd);
  const sortedRows = breakdown.rows.slice().sort((a, b) => barValue(b) - barValue(a));

  // Hooks must run unconditionally on every render, so the count-up target is
  // computed above any early return below (an empty `rows` just yields 0).
  const { value: countUpValue, ref: countUpRef } = useCountUp<HTMLDivElement>(
    leadsFirst ? breakdown.totalLowLeads : breakdown.totalLowUsd
  );

  if (!ready || rows.length === 0) return null;

  const maxLow = Math.max(...sortedRows.map(barValue), 1);
  const lostLabel = arpu.isTransactionalConsumerSpend
    ? "estimated sales lost, per month"
    : "estimated revenue lost, per month";
  const recoverableTotal = round2SigFigs(breakdown.totalLowUsd * RECOVERABLE_SHARE);
  const recoverableLeads = round2SigFigs(breakdown.totalLowLeads * RECOVERABLE_SHARE);

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
          {leadsFirst ? "estimated leads lost, per month" : lostLabel}
        </div>
        <div className="mt-2 text-sm text-[var(--muted)]">
          Could reach{" "}
          {leadsFirst
            ? `${breakdown.totalHighLeads.toLocaleString("en-US")} leads/mo`
            : formatMoney(breakdown.totalHighUsd)}
          .
        </div>
        {breakdown.capped && (
          <div className="mt-1 text-xs text-[var(--muted)]">
            Conservatively capped to your estimated revenue scale.
          </div>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {sortedRows.map((row, i) => {
          const widthPct = Math.max(6, Math.round((barValue(row) / maxLow) * 100));
          const recoverablePct = widthPct * RECOVERABLE_SHARE;
          return (
            <div key={i}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-medium leading-snug">
                  {truncateLabel(row.qv.query)}{" "}
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
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${widthPct}%`, background: "var(--miss)" }}
                />
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${recoverablePct}%`, background: "rgba(110,231,168,0.55)" }}
                />
              </div>
              {row.agg.winners.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {row.agg.winners.slice(0, 3).map((w, wi) => (
                    <span
                      key={wi}
                      className="rounded-md border border-[var(--panel-line)] bg-[var(--ink-soft)] px-2 py-0.5 text-xs"
                    >
                      {w.name}
                      {!w.verified && (
                        <span className="ml-1 text-[9px] text-[var(--muted)]">unverified</span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: "var(--miss)" }} />
          Lost today
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: "rgba(110,231,168,0.7)" }} />
          Recoverable
        </span>
      </div>

      <p className="mt-4 text-sm font-medium" style={{ color: "var(--win)" }}>
        {pricingUnknown
          ? `Estimated ${recoverableLeads.toLocaleString("en-US")} leads/mo recoverable. Illustrative, based on past campaigns.`
          : `Estimated ${formatMoney(recoverableTotal)} per month recoverable. Illustrative, based on past campaigns.`}
      </p>

      <p className="mt-3 text-xs text-[var(--muted)]">
        {pricingUnknown
          ? "Estimates based on public search demand. We couldn't verify your pricing, so this is shown in leads, not dollars. Directional, not audited."
          : "Estimates based on public search demand and your revenue model. Directional, not audited."}
      </p>

      <button
        type="button"
        onClick={() => setShowMethod((v) => !v)}
        className="mt-3 text-xs text-[var(--muted)] underline underline-offset-2"
      >
        {showMethod ? "Hide" : "How we calculated this"}
      </button>
      {showMethod && (
        <div className="mt-2 rounded-xl border border-[var(--panel-line)] bg-[var(--ink-soft)] p-4 text-xs leading-relaxed text-[var(--muted)]">
          {pricingUnknown ? (
            <>
              Each query gets a demand tier (niche to mass) with a fixed
              monthly ask-volume band. A capture rate (0.5-5%, smaller for
              bigger categories) converts demand into a realistic win rate,
              shown here as leads rather than dollars — we couldn&apos;t find
              your pricing anywhere, so converting that to a revenue figure
              would just be a guess dressed up as a number.
            </>
          ) : (
            <>
              Each query gets a demand tier (niche to mass) with a fixed
              monthly ask-volume band, priced against the specific product
              it&apos;s about at {formatAnchorPrice(arpu)}/{arpu.transactionNoun}{" "}
              where no product maps. A capture rate (0.5-5%, smaller for
              bigger categories) converts demand into a realistic win rate.
              The total is capped to a share of your estimated revenue so the
              number stays credible.
            </>
          )}
        </div>
      )}
    </section>
  );
}
