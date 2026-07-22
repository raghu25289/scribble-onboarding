"use client";

import type { ArpuVerdict, Classification } from "@/lib/types";

const CLASSIFICATION_COPY: Record<
  Classification,
  { badge: string; badgeColor: string; headline: string; subhead: string }
> = {
  leads: {
    badge: "Leads channel",
    badgeColor: "var(--accent)",
    headline: "AI search is a lead channel for you.",
    subhead:
      "At this price point, buyers research before they buy — they ask AI assistants \"best X for Y\" questions before choosing. Every citation you win here converts directly into inbound pipeline, and at this price, even 20 to 30 AI-sourced leads a month makes the math work.",
  },
  brand: {
    badge: "Brand channel",
    badgeColor: "var(--win)",
    headline: "AI search is a brand channel for you.",
    subhead:
      "Your revenue per customer means AI search works as a brand channel: the priority is being mentioned accurately and recommended in the right light everywhere buyers ask.",
  },
  leads_low_volume: {
    badge: "Leads potential",
    badgeColor: "#f0b429",
    headline: "AI search is an early-mover opportunity for you.",
    subhead:
      "The economics work at this price — but AI query demand in this category is still thin. The play is owning these questions early, before demand matures and competitors catch on.",
  },
};

export default function ArpuCard({ arpu }: { arpu: ArpuVerdict }) {
  const copy = CLASSIFICATION_COPY[arpu.classification];

  return (
    <section className="fade-up rounded-2xl border border-[var(--panel-line)] bg-[var(--panel)] p-6">
      <div className="flex items-center gap-2">
        <span
          className="rounded-md px-2 py-0.5 text-xs font-semibold text-[var(--ink)]"
          style={{ background: copy.badgeColor }}
        >
          {copy.badge}
        </span>
        <span className="text-xs text-[var(--muted)]">
          Estimated ARPU: {arpu.estimate}
        </span>
      </div>

      <h3 className="mt-3 font-display text-xl font-semibold sm:text-2xl">
        {copy.headline}
      </h3>

      <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">
        {copy.subhead}
      </p>

      <div className="mt-4 rounded-xl border border-[var(--panel-line)] bg-[var(--ink-soft)] p-4">
        <div className="text-xs font-medium text-[var(--muted)]">How we estimated this</div>
        <p className="mt-1.5 text-sm leading-relaxed">{arpu.reasoning}</p>
      </div>
    </section>
  );
}
