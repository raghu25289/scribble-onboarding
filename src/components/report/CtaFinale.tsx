import type { ReportViewModel } from "@/lib/reportView";
import { BOOKING_URL, contactMailtoHref } from "@/lib/contact";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// Plain links only, no embed — this is the one shared CtaFinale, reused
// as-is by the live page and the static download (no more live/static split
// needed now that there's no Cal.com embed to keep out of the download's
// module graph).
export default function CtaFinale({ view }: { view: ReportViewModel }) {
  const { domain, completedAt } = view;

  return (
    <section className="rp-slide rp-slide-dark rp-cta-finale">
      <h2 className="rp-cta-headline">Your customer asks AI first. Be the answer.</h2>
      <p className="rp-cta-sub">
        This report was prepared by Scribble, the creator network that gets brands cited by AI.
      </p>
      <a href={BOOKING_URL} target="_blank" rel="noopener noreferrer" className="rp-cta-button">
        Book a call
      </a>
      <a href={contactMailtoHref(domain)} className="rp-cta-secondary">
        Or email us directly
      </a>
      <div className="rp-cta-footer">
        <p>Report generated {formatDate(completedAt)}. Estimates directional, not audited.</p>
        <p>
          <a href="/">Run this audit on any site</a>
        </p>
      </div>
    </section>
  );
}
