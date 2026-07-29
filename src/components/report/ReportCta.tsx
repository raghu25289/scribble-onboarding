"use client";

import { useEffect, useState } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";

const CAL_NAMESPACE = "report-strategy-call";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

interface Props {
  domain: string;
  headlineScorePct: number;
  completedAt: string;
}

export default function ReportCta({ domain, headlineScorePct, completedAt }: Props) {
  const calLink = process.env.NEXT_PUBLIC_CAL_LINK;
  const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL || "hello@scribble.xyz";
  const [showBooking, setShowBooking] = useState(false);

  useEffect(() => {
    if (!showBooking || !calLink) return;
    (async function () {
      const cal = await getCalApi({ namespace: CAL_NAMESPACE });
      cal("ui", { theme: "dark" });
    })();
  }, [showBooking, calLink]);

  const mailtoHref = `mailto:${contactEmail}?subject=${encodeURIComponent(
    `AI visibility for ${domain}`
  )}&body=${encodeURIComponent(
    `Hi, I saw the AI visibility report for ${domain} (${headlineScorePct}% visible today) and want to talk.`
  )}`;

  return (
    <section id="book" className="report-section mx-auto max-w-2xl px-6 py-24 text-center">
      <h2 className="font-display text-3xl font-semibold sm:text-4xl">
        Fix it before your competitors notice.
      </h2>
      <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-[var(--muted)]">
        This report was prepared by Scribble, the creator network that gets brands cited by AI.
      </p>

      <div className="report-no-print">
        {!showBooking && (
          <button
            type="button"
            onClick={() => setShowBooking(true)}
            className="mt-6 inline-block rounded-xl px-6 py-3.5 text-[15px] font-semibold text-[var(--ink)] transition hover:brightness-105"
            style={{ background: "var(--accent)" }}
          >
            Book a 20-minute strategy call
          </button>
        )}

        {showBooking && (
          <div className="mt-6 overflow-hidden rounded-xl border border-[var(--panel-line)] text-left">
            {calLink ? (
              <Cal
                namespace={CAL_NAMESPACE}
                calLink={calLink}
                style={{ width: "100%", height: "600px", overflow: "scroll" }}
                config={{
                  theme: "dark",
                  "metadata[brandUrl]": domain,
                  "metadata[visibilityScore]": `${headlineScorePct}%`,
                  "metadata[source]": "shared-report",
                }}
              />
            ) : (
              <p className="p-4 text-sm text-[var(--muted)]">
                Booking isn&apos;t configured yet. Set NEXT_PUBLIC_CAL_LINK to enable it.
              </p>
            )}
          </div>
        )}

        <a
          href={mailtoHref}
          className="mt-3 block text-sm text-[var(--muted)] underline underline-offset-2 transition hover:text-[var(--paper)]"
        >
          Or email us directly
        </a>
      </div>

      <div className="mt-14 space-y-1 text-xs text-[var(--muted)]">
        <p>Report generated {formatDate(completedAt)}. Estimates directional, not audited.</p>
        <p>
          <a href="/" className="underline underline-offset-2 hover:text-[var(--paper)]">
            Run this audit on any site
          </a>
        </p>
      </div>
    </section>
  );
}
