"use client";

import { computeHeadlineScore, isQueryFullyChecked } from "@/lib/engineVisibility";
import type { BrandUnderstanding, QueryWithDemand, QueryVisibility } from "@/lib/types";
import VisibilityRow from "./VisibilityRow";

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold sm:text-3xl">
            Where <span style={{ color: "var(--accent)" }}>{domain}</span> shows
            up in AI answers
          </h2>
          {brand && (
            <p className="mt-1 text-sm text-[var(--muted)]">
              {brand.category} · for {brand.audience}
            </p>
          )}
        </div>

        {allDone && totalChecks > 0 && (
          <div className="text-right">
            <div className="font-display text-3xl font-semibold">
              <span style={{ color: visibleChecks > 0 ? "var(--win)" : "var(--miss)" }}>
                {visibleChecks}
              </span>
              <span className="text-[var(--muted)]">/{totalChecks}</span>
            </div>
            <div className="text-xs text-[var(--muted)]">engine checks you appear in</div>
          </div>
        )}
      </div>

      {allDone && visibleChecks === 0 && totalChecks > 0 && (
        <div
          className="mt-4 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: "rgba(255,107,107,0.35)", background: "rgba(255,107,107,0.08)" }}
        >
          You&apos;re invisible across every AI engine we checked for all {total} of
          your highest-intent buyer questions. Buyers asking AI about your
          category are being sent to competitors right now.
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
