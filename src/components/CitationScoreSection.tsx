"use client";

import type { PillarId, PillarScore, PillarScores } from "@/lib/types";
import { bandColor } from "@/lib/severity";

const PILLAR_TARGETS: Record<PillarId, { target: number; note?: string }> = {
  onsite: { target: 70, note: "you can fix this today" },
  reviews: { target: 65 },
  thirdparty: { target: 75 },
};

export default function CitationScoreSection({ pillars }: { pillars: PillarScores }) {
  const rows: PillarScore[] = [pillars.onsite, pillars.reviews, pillars.thirdparty];

  return (
    <section className="fade-up rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-6">
      <h3 className="font-display text-xl font-semibold sm:text-2xl">
        Why AI doesn&apos;t cite you
      </h3>

      <div className="mt-5 space-y-7">
        {rows.map((pillar) => (
          <PillarMeter key={pillar.id} pillar={pillar} />
        ))}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-[var(--ink-45)]">
        Typical progression over a 90-day creator program. Illustrative, based on past campaigns.
      </p>

      <p className="mt-4 text-sm leading-relaxed text-[var(--ink-45)]">
        Your site you can fix. Independent voices citing you is what
        Scribble&apos;s creator network does.
      </p>
    </section>
  );
}

function PillarMeter({ pillar }: { pillar: PillarScore }) {
  const color = bandColor(pillar.score);
  const { target, note } = PILLAR_TARGETS[pillar.id];

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{pillar.label}</span>
        <span className="shrink-0 font-semibold tabular-nums" style={{ color }}>
          {pillar.score}/100
        </span>
      </div>

      <div className="relative mt-1.5 h-2.5 w-full rounded-sm bg-[var(--border)]">
        <div
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{ width: `${target}%`, background: "var(--lime-tint)" }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{ width: `${Math.max(2, pillar.score)}%`, background: color }}
        />
        <div
          className="absolute h-[16px]"
          style={{
            left: `${target}%`,
            top: "-3px",
            borderLeft: "1.5px dashed var(--lime-deep)",
          }}
        />
      </div>

      <div className="relative mt-1 h-3">
        <span
          className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-[var(--ink-45)]"
          style={{ left: `${target}%` }}
        >
          target{note ? ` (${note})` : ""}
        </span>
      </div>

      <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-45)]">{pillar.gap}</p>
    </div>
  );
}
