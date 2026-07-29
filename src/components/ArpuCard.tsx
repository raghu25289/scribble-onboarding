"use client";

import { useState } from "react";
import type { ArpuVerdict, Classification } from "@/lib/types";

const CLASSIFICATION_COPY: Record<
  Classification,
  { badge: string; badgeColor: string; headline: string; subhead: string }
> = {
  leads: {
    badge: "Leads channel",
    badgeColor: "var(--lime)",
    headline: "AI search is a lead channel for you.",
    subhead:
      "Buyers research on AI before they buy. Every citation you win becomes pipeline you're not capturing today.",
  },
  brand: {
    badge: "Brand channel",
    badgeColor: "var(--lime-deep)",
    headline: "AI search is a brand channel for you.",
    subhead:
      "Your price point makes this about reputation, not leads: be accurate and recommended everywhere buyers ask.",
  },
  leads_low_volume: {
    badge: "Leads potential",
    badgeColor: "var(--lime-tint)",
    headline: "AI search is an early-mover opportunity for you.",
    subhead:
      "The economics work here, but demand is still young. Own these questions now, before competitors catch on.",
  },
  unknown_pricing: {
    badge: "Pricing unknown",
    badgeColor: "var(--border)",
    headline: "Pricing not detectable from your site.",
    subhead:
      "AI assistants hit the same wall. If we can't read your pricing, neither can they.",
  },
};

const CONFIDENCE_LABEL: Record<Exclude<ArpuVerdict["priceConfidence"], undefined>, string> = {
  found_on_site: "",
  search_derived: "from a web search, not your site",
  assumed: "assumed, not directly stated",
};

export default function ArpuCard({ arpu }: { arpu: ArpuVerdict }) {
  const [showMethod, setShowMethod] = useState(false);
  const copy = CLASSIFICATION_COPY[arpu.classification];
  const pricingUnknown = arpu.classification === "unknown_pricing";
  const confidenceNote =
    arpu.priceConfidence && arpu.priceConfidence !== "found_on_site"
      ? CONFIDENCE_LABEL[arpu.priceConfidence]
      : null;

  return (
    <section className="fade-up rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-6">
      <div className="flex items-center gap-2">
        <span
          className="rounded-lg px-2 py-0.5 text-xs font-semibold text-[var(--ink)]"
          style={{ background: copy.badgeColor }}
        >
          {copy.badge}
        </span>
        {!pricingUnknown && (
          <span className="text-xs text-[var(--ink-45)]">
            Estimated ARPU: {arpu.estimate}
            {confidenceNote && (
              <span className="ml-1 italic text-[var(--ink-45)] opacity-70">({confidenceNote})</span>
            )}
          </span>
        )}
      </div>

      <h3 className="mt-3 font-display text-xl font-semibold sm:text-2xl">
        {copy.headline}
      </h3>

      <p className="mt-2 text-[15px] leading-relaxed text-[var(--ink-45)]">
        {copy.subhead}
      </p>

      <button
        type="button"
        onClick={() => setShowMethod((v) => !v)}
        className="mt-3 text-xs text-[var(--ink-45)] underline underline-offset-2"
      >
        {showMethod ? "Hide" : "How we calculated this"}
      </button>
      {showMethod && (
        <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-4">
          <p className="text-sm leading-relaxed">{arpu.reasoning}</p>
        </div>
      )}
    </section>
  );
}
