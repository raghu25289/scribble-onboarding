"use client";

import { REAL_ENGINES, QUERY_ROW_GRID_TEMPLATE } from "@/lib/engineVisibility";
import type { EngineId } from "@/lib/types";

const ENGINE_LABELS: Record<EngineId, string> = {
  web: "Web",
  perplexity: "Perplexity",
  chatgpt: "ChatGPT",
};

// Engine names shown once above the query card list, in the same grid
// columns every card's engine cells align to — not repeated per card.
export default function EngineColumnHeaders() {
  return (
    <div className="grid items-center gap-2 px-4" style={{ gridTemplateColumns: QUERY_ROW_GRID_TEMPLATE }}>
      <div />
      {REAL_ENGINES.map((engine) => (
        <div
          key={engine}
          className="truncate text-center text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]"
        >
          {ENGINE_LABELS[engine]}
        </div>
      ))}
      <div />
    </div>
  );
}
