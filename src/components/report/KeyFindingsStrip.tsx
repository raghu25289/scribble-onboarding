import Num from "./Num";
import type { ReportViewModel } from "@/lib/reportView";

// "The abstract" — a reader who stops here has the story. Plain (non-client)
// component: Num/Bar/Gauge take only serializable props, so this composes
// fine as a Server Component on the live page AND gets reused as-is by the
// static download route.
export default function KeyFindingsStrip({ view, isStatic }: { view: ReportViewModel; isStatic: boolean }) {
  const { scorePct, scoreColor, buyerVolume, category, hasRisk, belowFloor, riskHeader, conservativeLoss, recoverable, isPipeline } =
    view;

  return (
    <div className="rp-container">
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
                <Num isStatic={isStatic} value={conservativeLoss} format={{ kind: isPipeline ? "leadsPerMo" : "money" }} />
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
        of AI answers in {category} mention {view.domain} today.
      </p>
    </div>
  );
}
