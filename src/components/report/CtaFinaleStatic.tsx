import type { ReportViewModel } from "@/lib/reportView";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function mailtoHref(domain: string, scorePct: number, contactEmail: string): string {
  return `mailto:${contactEmail}?subject=${encodeURIComponent(
    `AI visibility for ${domain}`
  )}&body=${encodeURIComponent(
    `Hi, I saw the AI visibility report for ${domain} (${scorePct}% visible today) and want to talk.`
  )}`;
}

// No "use client", no Cal.com import: this is the ONLY CtaFinale variant the
// standalone HTML download ever touches, so its module graph stays free of
// any browser-only or third-party embed code.
export default function CtaFinaleStatic({ view }: { view: ReportViewModel }) {
  const { domain, scorePct, completedAt, calLink, contactEmail } = view;
  const bookingUrl = calLink ? `https://cal.com/${calLink}` : undefined;

  return (
    <section className="rp-cta-finale">
      <h2 className="rp-cta-headline">Your customer asks AI first. Be the answer.</h2>
      <p className="rp-cta-sub">
        This report was prepared by Scribble, the creator network that gets brands cited by AI.
      </p>
      {bookingUrl && (
        <a href={bookingUrl} className="rp-cta-button">
          Book a call
        </a>
      )}
      <a href={mailtoHref(domain, scorePct, contactEmail)} className="rp-cta-secondary">
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
