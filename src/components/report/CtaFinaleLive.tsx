"use client";

import { useEffect, useState } from "react";
import Cal, { getCalApi } from "@calcom/embed-react";
import type { ReportViewModel } from "@/lib/reportView";
import { mailtoHref } from "./CtaFinaleStatic";

const CAL_NAMESPACE = "report-strategy-call";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Live page only — keeps the interactive inline Cal.com booking widget
// exactly as before. The download never imports this file.
export default function CtaFinaleLive({ view }: { view: ReportViewModel }) {
  const { domain, scorePct, completedAt, calLink, contactEmail } = view;
  const [showBooking, setShowBooking] = useState(false);

  useEffect(() => {
    if (!showBooking || !calLink) return;
    (async function () {
      const cal = await getCalApi({ namespace: CAL_NAMESPACE });
      cal("ui", { theme: "light" });
    })();
  }, [showBooking, calLink]);

  return (
    <section className="rp-cta-finale">
      <h2 className="rp-cta-headline">Your customer asks AI first. Be the answer.</h2>
      <p className="rp-cta-sub">
        This report was prepared by Scribble, the creator network that gets brands cited by AI.
      </p>

      <div className="rp-no-print">
        {!showBooking && (
          <button type="button" onClick={() => setShowBooking(true)} className="rp-cta-button">
            Book a call
          </button>
        )}

        {showBooking && (
          <div className="rp-cta-embed">
            {calLink ? (
              <Cal
                namespace={CAL_NAMESPACE}
                calLink={calLink}
                style={{ width: "100%", height: "600px", overflow: "scroll" }}
                config={{
                  theme: "light",
                  "metadata[brandUrl]": domain,
                  "metadata[visibilityScore]": `${scorePct}%`,
                  "metadata[source]": "shared-report",
                }}
              />
            ) : (
              <p style={{ padding: 16, fontSize: 13, opacity: 0.7 }}>
                Booking isn&apos;t configured yet. Set NEXT_PUBLIC_CAL_LINK to enable it.
              </p>
            )}
          </div>
        )}

        <a href={mailtoHref(domain, scorePct, contactEmail)} className="rp-cta-secondary">
          Or email us directly
        </a>
      </div>

      <div className="rp-cta-footer">
        <p>Report generated {formatDate(completedAt)}. Estimates directional, not audited.</p>
        <p>
          <a href="/">Run this audit on any site</a>
        </p>
      </div>
    </section>
  );
}
