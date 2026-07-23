"use client";

import { useState } from "react";
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
      "Buyers research on AI before they buy. Every citation you win becomes pipeline you're not capturing today.",
  },
  brand: {
    badge: "Brand channel",
    badgeColor: "var(--win)",
    headline: "AI search is a brand channel for you.",
    subhead:
      "Your price point makes this about reputation, not leads: be accurate and recommended everywhere buyers ask.",
  },
  leads_low_volume: {
    badge: "Leads potential",
    badgeColor: "#f0b429",
    headline: "AI search is an early-mover opportunity for you.",
    subhead:
      "The economics work here, but demand is still young. Own these questions now, before competitors catch on.",
  },
};

export default function ArpuCard({ arpu }: { arpu: ArpuVerdict }) {
  const [showMethod, setShowMethod] = useState(false);
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

      <button
        type="button"
        onClick={() => setShowMethod((v) => !v)}
        className="mt-3 text-xs text-[var(--muted)] underline underline-offset-2"
      >
        {showMethod ? "Hide" : "How we calculated this"}
      </button>
      {showMethod && (
        <div className="mt-2 rounded-xl border border-[var(--panel-line)] bg-[var(--ink-soft)] p-4">
          <p className="text-sm leading-relaxed">{arpu.reasoning}</p>
        </div>
      )}
    </section>
  );
}
