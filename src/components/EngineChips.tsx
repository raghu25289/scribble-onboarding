"use client";

import { REAL_ENGINES } from "@/lib/engineVisibility";
import type { EngineId, QueryVisibility } from "@/lib/types";

const ENGINE_LABELS: Record<EngineId, string> = {
  web: "Open web baseline",
  perplexity: "Perplexity",
  chatgpt: "ChatGPT",
};

export default function EngineChips({ visibility }: { visibility: QueryVisibility }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {REAL_ENGINES.map((engine) => {
        const result = visibility.engines[engine];
        return <EngineChip key={engine} label={ENGINE_LABELS[engine]} result={result} />;
      })}
    </div>
  );
}

function EngineChip({
  label,
  result,
}: {
  label: string;
  result: QueryVisibility["engines"][EngineId];
}) {
  if (!result) {
    return (
      <span className="skeleton inline-flex h-6 w-24 shrink-0 rounded-full" />
    );
  }
  if (!result.ok) {
    return (
      <span className="shrink-0 rounded-full border border-[var(--panel-line)] px-2.5 py-1 text-xs text-[var(--muted)]">
        {label} · Couldn&apos;t check
      </span>
    );
  }
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--ink)]"
      style={{ background: result.visible ? "var(--win)" : "var(--miss)" }}
    >
      {label} · {result.visible ? "Visible" : "Invisible"}
    </span>
  );
}
