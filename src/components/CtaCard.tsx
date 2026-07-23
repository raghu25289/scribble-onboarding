"use client";

import { useEffect, useState } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import { isValidEmail } from "@/lib/validate";

const CAL_NAMESPACE = "strategy-call";

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
  const calLink = process.env.NEXT_PUBLIC_CAL_LINK;
  const score = `${visibleCount}/${total}`;

  const [showBooking, setShowBooking] = useState(false);

  useEffect(() => {
    if (!showBooking) return;
    if (!calLink) {
      console.warn(
        "[CtaCard] NEXT_PUBLIC_CAL_LINK is not set; skipping Cal.com embed init."
      );
      return;
    }
    (async function () {
      const cal = await getCalApi({ namespace: CAL_NAMESPACE });
      cal("ui", { theme: "dark" });
    })();
  }, [showBooking, calLink]);

  const subhead = hasInvisible
    ? `AI changes weekly. ${topInvisibleCompetitor ?? "A competitor"} is winning these questions right now.`
    : "You're visible today. Staying cited is the real game.";

  return (
    <section
      className="fade-up rounded-2xl border p-6 text-center"
      style={{
        borderColor: "rgba(198,242,78,0.3)",
        background:
          "linear-gradient(180deg, rgba(198,242,78,0.06), rgba(198,242,78,0.02))",
      }}
    >
      <h3 className="font-display text-2xl font-semibold sm:text-3xl">
        Fix this before your competitors notice.
      </h3>
      <p className="mx-auto mt-2 max-w-lg text-[15px] leading-relaxed text-[var(--muted)]">
        {subhead}
      </p>

      {!showBooking && (
        <button
          type="button"
          onClick={() => setShowBooking(true)}
          className="mt-5 inline-block rounded-xl px-6 py-3.5 text-[15px] font-semibold text-[var(--ink)] transition hover:brightness-105"
          style={{ background: "var(--accent)" }}
        >
          Book a 20-minute strategy call
        </button>
      )}

      {showBooking && (
        <div className="mt-5 overflow-hidden rounded-xl border border-[var(--panel-line)] text-left">
          {calLink ? (
            <Cal
              namespace={CAL_NAMESPACE}
              calLink={calLink}
              style={{ width: "100%", height: "600px", overflow: "scroll" }}
              config={{
                theme: "dark",
                "metadata[brandUrl]": domain,
                "metadata[visibilityScore]": score,
              }}
            />
          ) : (
            <p className="p-4 text-sm text-[var(--muted)]">
              Booking isn&apos;t configured yet. Set NEXT_PUBLIC_CAL_LINK to
              enable it.
            </p>
          )}
        </div>
      )}

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
      <p className="mt-3 text-sm text-[var(--win)]">
        Done. Your full audit lands in your inbox within 24 hours.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 block w-full text-sm text-[var(--muted)] underline underline-offset-2 transition hover:text-[var(--paper)]"
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
        className="w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel)] px-4 py-3 text-[15px] outline-none transition focus:border-[var(--accent)] disabled:opacity-60"
      />
      <input
        type="text"
        value={companyName}
        onChange={(e) => setCompanyName(e.target.value)}
        placeholder="Company name"
        autoComplete="organization"
        disabled={submitting}
        className="w-full rounded-xl border border-[var(--panel-line)] bg-[var(--panel)] px-4 py-3 text-[15px] outline-none transition focus:border-[var(--accent)] disabled:opacity-60"
      />
      {error && <p className="text-sm text-[var(--miss)]">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-xl px-4 py-3 text-[15px] font-semibold text-[var(--ink)] transition hover:brightness-105 disabled:opacity-60"
        style={{ background: "var(--accent)" }}
      >
        {submitting ? "Sending…" : "Send me the audit"}
      </button>
    </form>
  );
}
