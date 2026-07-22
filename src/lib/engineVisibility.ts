// Pure helpers over QueryVisibility — no I/O, safe to import from both server
// (analyze.ts) and client components. "web" (the Open web baseline) is
// deliberately excluded here: chips, the headline score, and the
// invisible/visible verdict used everywhere downstream are reserved for the
// real engines.

import type { EngineId, QueryVisibility } from "./types";

export const REAL_ENGINES: EngineId[] = ["perplexity", "chatgpt"];
export const ALL_ENGINES: EngineId[] = ["web", "perplexity", "chatgpt"];

export interface QueryAggregate {
  visibleCount: number;
  checkedCount: number; // real engines that resolved ok (excludes failures)
  invisible: boolean; // true when the brand is absent from the majority of engines checked
  winners: string[]; // deduped, in first-seen order, across real engines
}

export function aggregateQuery(qv: QueryVisibility): QueryAggregate {
  const results = REAL_ENGINES.map((e) => qv.engines[e]).filter(
    (r): r is NonNullable<typeof r> => !!r && r.ok
  );
  const visibleCount = results.filter((r) => r.visible).length;
  const checkedCount = results.length;
  // Not a strict majority visible (0 checked, or a tie, both read as invisible).
  const invisible = checkedCount === 0 ? true : visibleCount <= checkedCount / 2;

  const winners: string[] = [];
  for (const r of results) {
    for (const w of r.winners) {
      if (!winners.includes(w)) winners.push(w);
    }
  }

  return { visibleCount, checkedCount, invisible, winners };
}

// The new headline score: visible engine-checks out of total engine-checks
// across all queries and real engines (not visible queries out of total queries).
export function computeHeadlineScore(queries: QueryVisibility[]): {
  visible: number;
  total: number;
} {
  let visible = 0;
  let total = 0;
  for (const qv of queries) {
    const agg = aggregateQuery(qv);
    visible += agg.visibleCount;
    total += agg.checkedCount;
  }
  return { visible, total };
}

// True once every engine (web + both real engines) has resolved, ok or not.
export function isQueryFullyChecked(qv: QueryVisibility): boolean {
  return ALL_ENGINES.every((e) => qv.engines[e] !== undefined);
}
