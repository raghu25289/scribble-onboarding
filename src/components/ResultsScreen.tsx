"use client";

import { computeHeadlineScore, isQueryFullyChecked } from "@/lib/engineVisibility";
import type { BrandUnderstanding, QueryWithDemand, QueryVisibility } from "@/lib/types";
import VisibilityRow from "./VisibilityRow";
import VisibilityGauge from "./VisibilityGauge";
import EngineGrid from "./EngineGrid";

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
        {queries.map((q, i) => (
          <VisibilityRow
            key={i}
            index={i}
            query={q.text}
            visibility={visibility[i] ?? { query: q.text, engines: {} }}
          />
        ))}
      </div>
    </section>
  );
}
