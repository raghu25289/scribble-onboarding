"use client";

import { aggregateQuery, computeHeadlineScore, isQueryFullyChecked } from "@/lib/engineVisibility";
import type { BrandUnderstanding, QueryWithDemand, QueryVisibility } from "@/lib/types";
import VisibilityRow from "./VisibilityRow";
import VisibilityGauge from "./VisibilityGauge";
import EngineGrid from "./EngineGrid";
import EngineColumnHeaders from "./EngineColumnHeaders";

interface Props {
  domain: string;
  brand: BrandUnderstanding | null;
  queries: QueryWithDemand[];
  visibility: QueryVisibility[];
}

export default function ResultsScreen({ domain, brand, queries, visibility }: Props) {
  const total = queries.length;
  const allDone = total > 0 && visibility.every(isQueryFullyChecked);
  const { visible: visibleChecks, total: totalChecks } = computeHeadlineScore(visibility);

  // Fully-invisible cards sort first so the worst gaps are the first thing
  // scanned; a stable sort keeps ties in their original order.
  const rows = queries
    .map((q, i) => ({
      originalIndex: i,
      query: q.text,
      visibility: visibility[i] ?? { query: q.text, engines: {} },
    }))
    .map((row) => ({ ...row, agg: aggregateQuery(row.visibility) }))
    .sort((a, b) => Number(!a.agg.invisible) - Number(!b.agg.invisible));

  return (
    <section className="fade-up">
      <h2 className="font-display text-2xl font-semibold sm:text-3xl">
        Where <span style={{ color: "var(--accent)" }}>{domain}</span> shows
        up in AI answers
      </h2>
      {brand && (
        <p className="mt-1 text-sm text-[var(--muted)]">
          {brand.category} · for {brand.audience}
        </p>
      )}

      {totalChecks > 0 && (
        <div className="mt-5 flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <VisibilityGauge visible={visibleChecks} total={totalChecks} />
          <EngineGrid visibility={visibility} />
        </div>
      )}

      {allDone && visibleChecks === 0 && totalChecks > 0 && (
        <div
          className="mt-4 rounded-xl border px-4 py-3 text-sm leading-snug"
          style={{ borderColor: "rgba(255,107,107,0.35)", background: "rgba(255,107,107,0.08)" }}
        >
          Invisible on every engine, for all {total} questions buyers ask.
          Competitors are getting recommended instead.
        </div>
      )}

      <div className="mt-5 space-y-3">
        {rows.length > 0 && <EngineColumnHeaders />}
        {rows.map((row, displayIndex) => (
          <VisibilityRow
            key={row.originalIndex}
            index={displayIndex}
            query={row.query}
            visibility={row.visibility}
            domain={domain}
            products={brand?.products ?? []}
          />
        ))}
      </div>
    </section>
  );
}
