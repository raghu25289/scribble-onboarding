"use client";

import type { PillarScore, PillarScores } from "@/lib/types";
import { bandColor } from "@/lib/severity";

export default function CitationScoreSection({ pillars }: { pillars: PillarScores }) {
  const rows: PillarScore[] = [pillars.onsite, pillars.reviews, pillars.thirdparty];

  return (
    <section className="fade-up rounded-2xl border border-[var(--panel-line)] bg-[var(--panel)] p-6">
      <h3 className="font-display text-xl font-semibold sm:text-2xl">
        Why AI doesn&apos;t cite you
      </h3>

      <div className="mt-5 space-y-5">
        {rows.map((pillar) => (
          <PillarMeter key={pillar.id} pillar={pillar} />
        ))}
      </div>

      <p className="mt-6 text-sm leading-relaxed text-[var(--muted)]">
        Your site you can fix. Independent voices citing you is what
        Scribble&apos;s creator network does.
      </p>
    </section>
  );
}

function PillarMeter({ pillar }: { pillar: PillarScore }) {
  const color = bandColor(pillar.score);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{pillar.label}</span>
        <span className="shrink-0 font-semibold tabular-nums" style={{ color }}>
          {pillar.score}/100
        </span>
      </div>
      <div className="mt-1.5 h-2.5 w-full rounded-full bg-[var(--ink-soft)]">
        <div
          className="h-2.5 rounded-full transition-[width]"
          style={{ width: `${Math.max(2, pillar.score)}%`, background: color }}
        />
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-[var(--muted)]">{pillar.gap}</p>
    </div>
  );
}
