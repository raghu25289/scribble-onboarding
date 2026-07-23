"use client";

import { useState } from "react";
import { aggregateQuery } from "@/lib/engineVisibility";
import type { QueryVisibility } from "@/lib/types";
import EngineChips from "./EngineChips";

interface Props {
  index: number;
  query: string;
  visibility: QueryVisibility;
}

// Keeps the expanded "Why" text to at most 2 sentences even if the model's
// snippet ran long.
function firstTwoSentences(text: string): string {
  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, 2).join(" ");
}

export default function VisibilityRow({ index, query, visibility }: Props) {
  const [showWhy, setShowWhy] = useState(false);
  const web = visibility.engines.web;
  const agg = aggregateQuery(visibility);

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
        <EngineChips visibility={visibility} />
      </div>

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

      {web?.ok && (
        <>
          <button
            type="button"
            onClick={() => setShowWhy((v) => !v)}
            className="mt-3 text-xs text-[var(--muted)] underline underline-offset-2"
          >
            {showWhy ? "Hide" : "Why"}
          </button>
          {showWhy && (
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">
              {firstTwoSentences(web.snippet)}
            </p>
          )}
        </>
      )}
    </div>
  );
}
