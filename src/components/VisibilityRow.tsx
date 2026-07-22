"use client";

import { aggregateQuery } from "@/lib/engineVisibility";
import type { QueryVisibility } from "@/lib/types";
import EngineChips from "./EngineChips";

interface Props {
  index: number;
  query: string;
  visibility: QueryVisibility;
}

export default function VisibilityRow({ index, query, visibility }: Props) {
  const web = visibility.engines.web;
  const agg = aggregateQuery(visibility);
  const webPending = web === undefined;

  return (
    <div
      className="rounded-xl border border-[var(--panel-line)] bg-[var(--panel)] p-4 fade-up"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[15px] font-medium leading-snug">
          <span className="mr-2 text-[var(--muted)]">{index + 1}.</span>
          {query}
        </p>
      </div>

      <div className="mt-3">
        {webPending ? (
          <div className="space-y-2">
            <div className="skeleton h-3 w-4/5 rounded" />
            <div className="skeleton h-3 w-3/5 rounded" />
          </div>
        ) : web.ok ? (
          <>
            <p className="text-xs font-medium text-[var(--muted)]">Open web baseline</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{web.snippet}</p>
            {agg.winners.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-[var(--muted)]">Winning today:</span>
                {agg.winners.map((w, i) => (
                  <span
                    key={i}
                    className="rounded-md border border-[var(--panel-line)] bg-[var(--ink-soft)] px-2 py-0.5 text-xs"
                  >
                    {w}
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            Open web baseline couldn&apos;t be checked for this question.
          </p>
        )}
      </div>

      <div className="mt-3">
        <EngineChips visibility={visibility} />
      </div>
    </div>
  );
}
