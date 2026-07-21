"use client";

import type { ArpuVerdict, QueryWithDemand, VisibilityResult } from "@/lib/types";
import { estimateQueryLoss, formatArpuRange, formatCompetitorList, formatMoney } from "@/lib/costEstimate";

interface Props {
  brand: string;
  arpu: ArpuVerdict;
  queries: QueryWithDemand[];
  visibility: VisibilityResult[]; // resolved, same order as queries
}

// Only renders when at least one query is invisible. Styled like ArpuCard's
// "How we estimated this" panel, but on the red/danger accent used for the
// Invisible badge.
export default function CostCard({ brand, arpu, queries, visibility }: Props) {
  if (visibility.length !== queries.length) return null;

  const invisible = visibility
    .map((v, i) => ({ v, demand: queries[i] }))
    .filter((row) => !row.v.visible);

  if (invisible.length === 0) return null;

  return (
    <section
      className="fade-up rounded-2xl border p-6"
      style={{ borderColor: "rgba(255,107,107,0.3)", background: "rgba(255,107,107,0.05)" }}
    >
      <span
        className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold text-[var(--ink)]"
        style={{ background: "var(--miss)" }}
      >
        Revenue at risk
      </span>

      <h3 className="mt-3 font-display text-xl font-semibold sm:text-2xl">
        What invisibility is costing {brand}.
      </h3>

      <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">
        Buyers are asking AI this question right now, and the answer never
        mentions you. Based on your estimated revenue of {formatArpuRange(arpu)}{" "}
        per {arpu.transactionNoun}, here is what that silence is worth.
      </p>

      <div className="mt-4 space-y-3">
        {invisible.map(({ v, demand }, i) => {
          const { lowUsd, highUsd } = estimateQueryLoss(demand, arpu);
          return (
            <div
              key={i}
              className="rounded-xl border border-[var(--panel-line)] bg-[var(--ink-soft)] p-4"
            >
              <p className="text-sm font-medium leading-snug">&ldquo;{v.query}&rdquo;</p>
              <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
                AI recommends {formatCompetitorList(v.winners)} instead. At
                even a small share of this demand, that is an estimated{" "}
                {formatMoney(lowUsd)} to {formatMoney(highUsd)} in lost
                revenue every month.
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-[var(--muted)]">
        Estimates based on public search demand and your revenue model.
        Directional, not audited.
      </p>
    </section>
  );
}
