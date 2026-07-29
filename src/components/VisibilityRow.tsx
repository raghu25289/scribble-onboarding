"use client";

import { useState } from "react";
import { aggregateQuery, severityColor, QUERY_ROW_GRID_TEMPLATE } from "@/lib/engineVisibility";
import { isBrandChip } from "@/lib/brandMatch";
import type { BrandProduct, QueryVisibility } from "@/lib/types";
import EngineChips from "./EngineChips";

interface Props {
  index: number;
  query: string;
  visibility: QueryVisibility;
  domain: string;
  products: BrandProduct[];
}

// Keeps the expanded "Why" text to at most 2 sentences even if the model's
// snippet ran long.
function firstTwoSentences(text: string): string {
  const parts = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  return parts.slice(0, 2).join(" ");
}

const CHIP_CAP = 4;

export default function VisibilityRow({ index, query, visibility, domain, products }: Props) {
  const [showWhy, setShowWhy] = useState(false);
  const [showAllChips, setShowAllChips] = useState(false);
  const web = visibility.engines.web;
  const agg = aggregateQuery(visibility);

  const tagged = agg.winners.map((w) => ({ ...w, isBrand: isBrandChip(w.name, domain, products) }));
  const brandPresent = tagged.some((w) => w.isBrand);
  const competitorCount = tagged.filter((w) => !w.isBrand).length;
  const label = brandPresent
    ? `You and ${competitorCount} other${competitorCount === 1 ? "" : "s"} are cited:`
    : "Winning instead of you:";
  const visibleChips = showAllChips ? tagged : tagged.slice(0, CHIP_CAP);
  const overflowCount = tagged.length - visibleChips.length;

  return (
    <div
      className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] fade-up"
      style={{ animationDelay: `${index * 40}ms`, borderLeft: `3px solid ${severityColor(agg)}` }}
    >
      <button
        type="button"
        onClick={() => web?.ok && setShowWhy((v) => !v)}
        className="grid w-full items-center gap-2 px-4 py-4 text-left"
        style={{ gridTemplateColumns: QUERY_ROW_GRID_TEMPLATE }}
      >
        <p className="min-w-0 truncate pr-2 text-[15px] font-medium leading-snug">{query}</p>
        <EngineChips visibility={visibility} />
        <svg
          className="mx-auto h-3.5 w-3.5 shrink-0 text-[var(--ink-45)] transition-transform duration-200"
          style={{ transform: showWhy ? "rotate(180deg)" : "none" }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="px-4 pb-4">
        {tagged.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-[var(--ink-45)]">{label}</span>
            {visibleChips.map((w, i) => (
              <span
                key={i}
                className={
                  "rounded-lg border px-2 py-0.5 text-xs " +
                  (w.isBrand
                    ? "border-transparent bg-[var(--lime-tint)] text-[var(--lime-deep)]"
                    : "border-[var(--border)] bg-[var(--bg-subtle)]")
                }
              >
                {w.isBrand && (
                  <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--lime-deep)]" />
                )}
                {w.name}
                {!w.verified && (
                  <span className="ml-1 text-[9px] text-[var(--ink-45)]">unverified</span>
                )}
              </span>
            ))}
            {overflowCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAllChips(true)}
                className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-2 py-0.5 text-xs text-[var(--ink-45)]"
              >
                +{overflowCount} more
              </button>
            )}
          </div>
        )}

        {showWhy && web?.ok && (
          <p className="mt-2.5 text-sm leading-relaxed text-[var(--ink-45)]">
            {firstTwoSentences(web.snippet)}
          </p>
        )}
      </div>
    </div>
  );
}
