"use client";

import type { AnalyzeStep } from "@/lib/types";

export interface PhaseState {
  key: AnalyzeStep;
  label: string;
}

const PHASES: PhaseState[] = [
  { key: "fetch_site", label: "Reading your website" },
  { key: "understand_brand", label: "Understanding what you do" },
  { key: "generate_queries", label: "Finding the 5 buyer questions" },
  { key: "check_visibility", label: "Checking Perplexity, ChatGPT & the open web" },
  { key: "assess_pillars", label: "Scoring why AI does or doesn't cite you" },
  { key: "classify_arpu", label: "Tailoring your recommendation" },
];

interface Props {
  activeStep: AnalyzeStep | null;
  completedSteps: Set<AnalyzeStep>;
  latestMessage: string | null;
  done: boolean;
}

export default function ProgressPanel({
  activeStep,
  completedSteps,
  latestMessage,
  done,
}: Props) {
  return (
    <div className="rounded-2xl border border-[var(--panel-line)] bg-[var(--panel)] p-5 fade-up">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          {done ? "Analysis complete" : "Scribble is working…"}
        </h2>
        {!done && latestMessage && (
          <span className="hidden max-w-[55%] truncate text-xs text-[var(--muted)] sm:inline">
            {latestMessage}
          </span>
        )}
      </div>

      <ol className="mt-4 space-y-2.5">
        {PHASES.map((p) => {
          const isDone = completedSteps.has(p.key) || done;
          const isActive = activeStep === p.key && !done;
          return (
            <li key={p.key} className="flex items-center gap-3">
              <span className="flex h-5 w-5 items-center justify-center">
                {isDone ? (
                  <span
                    className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-[var(--ink)]"
                    style={{ background: "var(--win)" }}
                  >
                    ✓
                  </span>
                ) : isActive ? (
                  <span
                    className="dot-pulse h-3 w-3 rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                ) : (
                  <span className="h-3 w-3 rounded-full border border-[var(--panel-line)]" />
                )}
              </span>
              <span
                className={
                  "text-sm " +
                  (isDone
                    ? "text-[var(--paper)]"
                    : isActive
                      ? "text-[var(--paper)]"
                      : "text-[var(--muted)]")
                }
              >
                {p.label}
              </span>
            </li>
          );
        })}
      </ol>

      {!done && latestMessage && (
        <p className="mt-4 truncate text-xs text-[var(--muted)] sm:hidden">
          {latestMessage}
        </p>
      )}
    </div>
  );
}
