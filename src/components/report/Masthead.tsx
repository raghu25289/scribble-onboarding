function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

interface Props {
  domain: string;
  completedAt: string;
  category: string;
}

export default function Masthead({ domain, completedAt, category }: Props) {
  return (
    <section className="rp-slide">
      <div className="rp-container">
        <span className="rp-header-wordmark">
          <span className="rp-dot" />
          Scribble
        </span>
        <hr className="rp-masthead-rule" />
        <span className="rp-label rp-eyebrow" style={{ display: "block" }}>
          AI Visibility Report
        </span>
        <h1 className="rp-domain">{domain}</h1>
        <p className="rp-meta">
          {formatDate(completedAt)} · {category}
        </p>
      </div>
      <span className="rp-scroll-hint" aria-hidden="true">
        ↓
      </span>
    </section>
  );
}
