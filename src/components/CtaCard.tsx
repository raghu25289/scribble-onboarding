"use client";

import { useState } from "react";
import { isValidEmail } from "@/lib/validate";
import { BOOKING_URL, contactMailtoHref } from "@/lib/contact";

interface Props {
  domain: string; // used as the brand name in copy
  visibleCount: number;
  total: number;
  topInvisibleCompetitor: string | null;
}

export default function CtaCard({
  domain,
  visibleCount,
  total,
  topInvisibleCompetitor,
}: Props) {
  const hasInvisible = visibleCount < total;
  const score = `${visibleCount}/${total}`;

  const subhead = hasInvisible
    ? `AI changes weekly. ${topInvisibleCompetitor ?? "A competitor"} is winning these questions right now.`
    : "You're visible today. Staying cited is the real game.";

  return (
    <section
      className="fade-up rounded-lg border p-6 text-center"
      style={{
        borderColor: "var(--lime-border)",
        background:
          "var(--lime-wash)"
      }}
    >
      <h3 className="font-display text-2xl font-semibold sm:text-3xl">
        Fix this before your competitors notice.
      </h3>
      <p className="mx-auto mt-2 max-w-lg text-[15px] leading-relaxed text-[var(--ink-45)]">
        {subhead}
      </p>

      <a
        href={BOOKING_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-5 inline-block rounded-lg px-6 py-3.5 text-[15px] font-semibold text-[var(--ink)] transition hover:brightness-105"
        style={{ background: "var(--lime)" }}
      >
        Book a 20-minute strategy call
      </a>
      <a
        href={contactMailtoHref(domain)}
        className="mt-3 block text-sm text-[var(--ink-45)] underline underline-offset-2 transition hover:text-[var(--ink)]"
      >
        Or email us directly
      </a>

      <AuditRequestCta domain={domain} score={score} />
    </section>
  );
}

function AuditRequestCta({ domain, score }: { domain: string; score: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!isValidEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!companyName.trim()) {
      setError("Enter your company name.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          companyName: companyName.trim(),
          domain,
          score,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong.");
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p className="mt-3 text-sm text-[var(--lime-deep)]">
        Done. Your full audit lands in your inbox within 24 hours.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 block w-full text-sm text-[var(--ink-45)] underline underline-offset-2 transition hover:text-[var(--ink)]"
      >
        Not ready to talk? Get the full 25-query audit by email.
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto mt-4 max-w-sm space-y-2.5 text-left"
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@company.com"
        autoComplete="email"
        disabled={submitting}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-[15px] outline-none transition focus:border-[var(--lime)] disabled:opacity-60"
      />
      <input
        type="text"
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        placeholder="Company name"
        autoComplete="organization"
        disabled={submitting}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3 text-[15px] outline-none transition focus:border-[var(--lime)] disabled:opacity-60"
      />
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-lg px-4 py-3 text-[15px] font-semibold text-[var(--ink)] transition hover:brightness-105 disabled:opacity-60"
        style={{ background: "var(--lime)" }}
      >
        {submitting ? "Sending…" : "Send me the audit"}
      </button>
    </form>
  );
}
