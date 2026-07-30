import Num from "./Num";
import type { ReportViewModel } from "@/lib/reportView";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

// The cover: brand identity up top, the key-findings abstract anchored to
// the lower half via the slide's own space-between layout (see
// .rp-slide-cover) — no separate findings slide.
export default function Masthead({ view, isStatic }: { view: ReportViewModel; isStatic: boolean }) {
  const {
    domain,
    completedAt,
    category,
    scorePct,
    scoreColor,
    buyerVolume,
    hasRisk,
    belowFloor,
    riskHeader,
    conservativeLoss,
    recoverable,
    isPipeline,
  } = view;

  return (
    <section className="rp-slide rp-slide-cover">
      <div className="rp-container">
        <span className="rp-header-wordmark">
          <span className="rp-dot" />
          Scribble
        </span>
        <hr className="rp-masthead-rule" />
        <span className="rp-label rp-eyebrow" style={{ display: "block" }}>
          AI Visibility Report
        </span>
        <h1 className="rp-domain rp-domain-compact">{domain}</h1>
        <p className="rp-meta">
          {formatDate(completedAt)} · {category}
        </p>
      </div>

      <div className="rp-container rp-cover-findings">
        <div className="rp-stats">
          <div className="rp-stat">
            <span className="rp-label">Visibility</span>
            <div
              className={`rp-stat-value ${scorePct < 40 ? "is-danger" : ""}`}
              style={{ color: scorePct < 40 ? undefined : scoreColor }}
            >
              <Num isStatic={isStatic} value={scorePct} format={{ kind: "percent" }} />
            </div>
          </div>
          <div className="rp-stat">
            <span className="rp-label">Buyer demand</span>
            <div className="rp-stat-value">
              <Num isStatic={isStatic} value={buyerVolume} format={{ kind: "perMo" }} />
            </div>
          </div>
          {hasRisk && (
            <div className="rp-stat">
              <span className="rp-label">{riskHeader}</span>
              <div className="rp-stat-value is-danger">
                {belowFloor ? (
                  <span style={{ fontSize: "1.1rem" }}>Every buyer, today</span>
                ) : (
                  <Num
                    isStatic={isStatic}
                    value={conservativeLoss}
                    format={{ kind: isPipeline ? "leadsPerMo" : "money" }}
                  />
                )}
              </div>
            </div>
          )}
          {hasRisk && (
            <div className="rp-stat">
              <span className="rp-label">Recoverable</span>
              <div className="rp-stat-value is-lime">
                {belowFloor ? (
                  <span style={{ fontSize: "1.1rem" }}>All of it</span>
                ) : (
                  <Num isStatic={isStatic} value={recoverable} format={{ kind: isPipeline ? "leadsPerMo" : "moneyPerMo" }} />
                )}
              </div>
            </div>
          )}
        </div>
        <p className="rp-context" style={{ marginTop: 16, marginBottom: 0 }}>
          of AI answers in {category} mention {domain} today.
        </p>
      </div>

      <span className="rp-scroll-hint" aria-hidden="true">
        ↓
      </span>
    </section>
  );
}
