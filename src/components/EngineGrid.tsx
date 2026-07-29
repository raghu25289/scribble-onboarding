"use client";

import { Fragment } from "react";
import { REAL_ENGINES } from "@/lib/engineVisibility";
import { truncateLabel } from "@/lib/costEstimate";
import type { EngineId, QueryVisibility } from "@/lib/types";

const ENGINE_LABELS: Record<EngineId, string> = {
  web: "Web",
  perplexity: "Perplexity",
  chatgpt: "ChatGPT",
};

// Queries as rows, engines as columns, green/red cells — this grid IS the
// story, no explanatory prose needed alongside it.
export default function EngineGrid({ visibility }: { visibility: QueryVisibility[] }) {
  if (visibility.length === 0) return null;

  return (
    <div className="min-w-0 flex-1">
      <div
        className="grid gap-x-3 gap-y-1.5"
        style={{ gridTemplateColumns: `1fr repeat(${REAL_ENGINES.length}, 44px)` }}
      >
        <div />
        {REAL_ENGINES.map((engine) => (
          <div key={engine} className="text-center text-[10px] font-medium text-[var(--ink-45)]">
            {ENGINE_LABELS[engine]}
          </div>
        ))}
        {visibility.map((qv, i) => (
          <Fragment key={i}>
            <div className="truncate text-xs text-[var(--ink-45)]" title={qv.query}>
              {truncateLabel(qv.query, 34)}
            </div>
            {REAL_ENGINES.map((engine) => {
              const result = qv.engines[engine];
              return <Cell key={`${i}-${engine}`} result={result} />;
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function Cell({ result }: { result: QueryVisibility["engines"][EngineId] }) {
  if (!result) {
    return <span className="skeleton mx-auto block h-5 w-5 rounded-lg" />;
  }
  if (!result.ok) {
    return (
      <span
        className="mx-auto block h-5 w-5 rounded-lg"
        style={{ background: "var(--border)" }}
        title="Couldn't check"
      />
    );
  }
  return (
    <span
      className="mx-auto block h-5 w-5 rounded-lg"
      style={{ background: result.visible ? "var(--lime-deep)" : "var(--danger)" }}
      title={result.visible ? "Visible" : "Invisible"}
    />
  );
}
