import Num from "./Num";
import CostBar from "./CostBar";
import type { ReportViewModel } from "@/lib/reportView";

export default function Section03WhatItCosts({ view, isStatic }: { view: ReportViewModel; isStatic: boolean }) {
  const { hasRisk, belowFloor, riskHeader, conservativeLoss, aggressiveLossFormatted, buyerVolume, isPipeline, costRows } =
    view;
  if (!hasRisk) return null;

  return (
    <section className="rp-slide">
      <div className="rp-container">
        <span className="rp-index">03</span>
        <h2 className="rp-h2">What it costs</h2>
        <p className="rp-context">{riskHeader}, estimated from public search demand. Directional, not audited.</p>

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
      </div>

      {costRows.length > 0 && (
        <div className="rp-wide" style={{ marginTop: 40 }}>
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
    </section>
  );
}
