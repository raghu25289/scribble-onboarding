"use client";

import type { ArpuVerdict } from "@/lib/types";

interface Props {
  branch: ArpuVerdict["branch"] | null;
  visibleCount: number;
  total: number;
}

export default function CtaCard({ branch, visibleCount, total }: Props) {
  const leadGen = branch === "lead-gen";
  const missing = total - visibleCount;

  // The CTA is tied to the branch the brand landed in.
  const headline = leadGen
    ? "Turn these queries into a lead channel."
    : "Make sure AI represents your brand correctly.";

  const sub = leadGen
    ? `You're missing ${missing} of ${total} high-intent queries. Let's map how to rank in each one and capture those buyers.`
    : `You're mentioned in ${visibleCount} of ${total} answers. Let's make sure every mention is accurate and puts your brand in the right light.`;

  const buttonLabel = leadGen ? "Book a strategy call →" : "Join the waitlist →";

  return (
    <section
      className="fade-up rounded-2xl border p-6 text-center"
      style={{
        borderColor: "rgba(198,242,78,0.3)",
        background:
          "linear-gradient(180deg, rgba(198,242,78,0.06), rgba(198,242,78,0.02))",
      }}
    >
      <h3 className="font-display text-2xl font-semibold sm:text-3xl">{headline}</h3>
      <p className="mx-auto mt-2 max-w-lg text-[15px] leading-relaxed text-[var(--muted)]">
        {sub}
      </p>
      <a
        href={leadGen ? "#book-a-call" : "#waitlist"}
        className="mt-5 inline-block rounded-xl px-6 py-3.5 text-[15px] font-semibold text-[var(--ink)] transition hover:brightness-105"
        style={{ background: "var(--accent)" }}
      >
        {buttonLabel}
      </a>
      <p className="mt-3 text-xs text-[var(--muted)]">
        We saved your results — we&apos;ll bring them to the conversation.
      </p>
    </section>
  );
}
