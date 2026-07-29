"use client";

import { REAL_ENGINES } from "@/lib/engineVisibility";
import type { EngineId, QueryVisibility } from "@/lib/types";

// Renders just the fixed-width pill cells for one query row — no per-cell
// engine label (those live once, above the list, in EngineColumnHeaders) —
// so it must be placed directly inside a grid using QUERY_ROW_GRID_TEMPLATE.
export default function EngineChips({ visibility }: { visibility: QueryVisibility }) {
  return (
    <>
      {REAL_ENGINES.map((engine) => (
        <EnginePill key={engine} result={visibility.engines[engine]} />
      ))}
    </>
  );
}

function EnginePill({ result }: { result: QueryVisibility["engines"][EngineId] }) {
  if (!result) {
    return <span className="skeleton mx-auto block h-6 w-9 rounded-full" />;
  }
  if (!result.ok) {
    return (
      <span
        className="mx-auto flex h-6 w-9 items-center justify-center rounded-full border border-[var(--border)] text-[10px] text-[var(--ink-45)]"
        title="Couldn't check"
      >
        –
      </span>
    );
  }
  return (
    <span
      className="mx-auto flex h-6 w-9 items-center justify-center rounded-full text-xs font-bold text-[var(--ink)]"
      style={{ background: result.visible ? "var(--lime-deep)" : "var(--danger)" }}
      title={result.visible ? "Visible" : "Invisible"}
    >
      {result.visible ? "✓" : "✕"}
    </span>
  );
}
