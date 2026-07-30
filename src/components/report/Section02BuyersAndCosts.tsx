import Bar from "./Bar";
import Num from "./Num";
import CostBar from "./CostBar";
import type { ReportViewModel } from "@/lib/reportView";

// Merged slide: competitor citation chart (left) + loss figures and bars
// (right) on desktop, stacked on mobile. Shares one header when both halves
// have data; falls back to either half's original standalone title when
// only one does, so the heading never claims content that isn't there.
export default function Section02BuyersAndCosts({ view, isStatic }: { view: ReportViewModel; isStatic: boolean }) {
  const {
    competitorBars,
    hasRisk,
    belowFloor,
    riskHeader,
    conservativeLoss,
    aggressiveLossFormatted,
    buyerVolume,
    isPipeline,
    costRows,
  } = view;

  const hasBuyers = competitorBars.length > 0;
  if (!hasBuyers && !hasRisk) return null;

  const heading =
    hasBuyers && hasRisk
      ? "Where your buyers go, and what it costs"
      : hasBuyers
        ? "Where buyers go instead"
        : "What it costs";

  return (
    <section className="rp-slide">
      <div className="rp-container">
        <span className="rp-index">02</span>
        <h2 className="rp-h2">{heading}</h2>
      </div>

      <div className="rp-wide">
        <div className="rp-split">
          {hasBuyers && (
            <div>
              <p className="rp-context" style={{ marginBottom: 16 }}>
                Who AI actually recommends when it doesn&apos;t recommend you.
              </p>
              <div className="rp-bars">
                {competitorBars.map((c) => (
                  <div key={c.name} className="rp-bar-row">
                    <span className={`rp-bar-name ${c.isBrand ? "is-brand" : ""}`}>{c.name}</span>
                    <div className="rp-bar-track">
                      <Bar isStatic={isStatic} pct={c.pct} className={`rp-bar-fill ${c.isBrand ? "is-brand" : ""}`} />
                    </div>
                    <span className="rp-bar-count">{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {hasRisk && (
            <div>
              <p className="rp-context" style={{ marginBottom: 16 }}>
                {riskHeader}, estimated from public search demand. Directional, not audited.
              </p>

              {belowFloor ? (
                <>
                  <p className="rp-cost-hero-qual">Every buyer asking today gets sent to a competitor.</p>
                  <p className="rp-cost-caption">
                    <Num isStatic={isStatic} value={buyerVolume} format={{ kind: "plain" }} /> buyers/mo asking
                  </p>
                </>
              ) : (
                <>
                  <div className="rp-cost-hero">
                    <Num isStatic={isStatic} value={conservativeLoss} format={{ kind: isPipeline ? "leadsPerMo" : "money" }} />
                  </div>
                  <p className="rp-cost-caption">per month, estimated · could reach {aggressiveLossFormatted}</p>
                </>
              )}

              {costRows.length > 0 && (
                <div style={{ marginTop: 32 }}>
                  <div className="rp-cost-bars">
                    {costRows.map((row, i) => (
                      <div key={i} className="rp-cost-row">
                        <div className="rp-cost-row-label">
                          <span className="rp-cost-row-name">{row.name}</span>
                          <span className="rp-cost-row-value">
                            {row.lowFormatted}–{row.highFormatted}
                          </span>
                        </div>
                        <CostBar isStatic={isStatic} lossPct={row.lossPct} recoverablePct={row.recoverablePct} />
                      </div>
                    ))}
                  </div>

                  <div className="rp-legend">
                    <span className="rp-legend-item">
                      <span className="rp-legend-dot is-danger" /> Lost today
                    </span>
                    <span className="rp-legend-item">
                      <span className="rp-legend-dot is-recoverable" /> Recoverable
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
