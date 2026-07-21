"use client";

import type { ArpuVerdict } from "@/lib/types";

export default function ArpuCard({ arpu }: { arpu: ArpuVerdict }) {
  const leadGen = arpu.branch === "lead-gen";

  return (
    <section className="fade-up rounded-2xl border border-[var(--panel-line)] bg-[var(--panel)] p-6">
      <div className="flex items-center gap-2">
        <span
          className="rounded-md px-2 py-0.5 text-xs font-semibold text-[var(--ink)]"
          style={{ background: leadGen ? "var(--accent)" : "var(--win)" }}
        >
          {leadGen ? "Lead-gen channel" : "Brand channel"}
        </span>
        <span className="text-xs text-[var(--muted)]">
          Estimated ARPU: {arpu.estimate}
        </span>
      </div>

      <h3 className="mt-3 font-display text-xl font-semibold sm:text-2xl">
        {leadGen
          ? "AI search is a lead-gen channel for you."
          : "AI search is a brand channel for you."}
      </h3>

      <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">
        {leadGen
          ? "Your revenue per customer is high enough that ranking in these 5 questions captures buyers directly. Each answer you win is a qualified lead sent to you instead of a competitor."
          : "Your revenue per customer means AI search works as a brand channel: the priority is being mentioned accurately and recommended in the right light everywhere buyers ask."}
      </p>

      <div className="mt-4 rounded-xl border border-[var(--panel-line)] bg-[var(--ink-soft)] p-4">
        <div className="text-xs font-medium text-[var(--muted)]">How we estimated this</div>
        <p className="mt-1.5 text-sm leading-relaxed">{arpu.reasoning}</p>
      </div>
    </section>
  );
}
