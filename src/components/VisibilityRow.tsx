"use client";

import type { VisibilityResult } from "@/lib/types";

interface Props {
  index: number;
  query: string;
  result: VisibilityResult | null; // null while still resolving
}

export default function VisibilityRow({ index, query, result }: Props) {
  const pending = result === null;

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
        <Badge pending={pending} visible={result?.visible ?? false} />
      </div>

      <div className="mt-3">
        {pending ? (
          <div className="space-y-2">
            <div className="skeleton h-3 w-4/5 rounded" />
            <div className="skeleton h-3 w-3/5 rounded" />
          </div>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-[var(--muted)]">
              {result!.snippet}
            </p>
            {!result!.visible && result!.winners.length > 0 && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-[var(--muted)]">Winning today:</span>
                {result!.winners.map((w, i) => (
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
        )}
      </div>
    </div>
  );
}

function Badge({ pending, visible }: { pending: boolean; visible: boolean }) {
  if (pending) {
    return (
      <span className="shrink-0 rounded-full border border-[var(--panel-line)] px-2.5 py-1 text-xs text-[var(--muted)]">
        checking…
      </span>
    );
  }
  if (visible) {
    return (
      <span
        className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--ink)]"
        style={{ background: "var(--win)" }}
      >
        Visible
      </span>
    );
  }
  return (
    <span
      className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--ink)]"
      style={{ background: "var(--miss)" }}
    >
      Invisible
    </span>
  );
}
