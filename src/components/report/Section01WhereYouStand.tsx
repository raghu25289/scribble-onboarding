import Gauge from "./Gauge";
import type { ReportViewModel } from "@/lib/reportView";

export default function Section01WhereYouStand({ view, isStatic }: { view: ReportViewModel; isStatic: boolean }) {
  const { scorePct, scoreColor, visibleChecks, totalChecks, engineLabels, matrixRows } = view;

  return (
    <section className="rp-slide">
      <div className="rp-container">
        <span className="rp-index">01</span>
        <h2 className="rp-h2">Where you stand</h2>
        <p className="rp-context">
          {visibleChecks} of {totalChecks} engine checks mention you across the buyer questions AI gets asked most.
        </p>
      </div>

      <div className="rp-wide">
        <div className="rp-gauge-row">
          <Gauge
            isStatic={isStatic}
            pct={scorePct}
            color={scoreColor}
            caption={`${visibleChecks}/${totalChecks} engine checks`}
          />
          <div className="rp-matrix-col">
            <table className="rp-matrix-table">
              <thead>
                <tr>
                  <th>Query</th>
                  {engineLabels.map((label) => (
                    <th key={label} className="rp-th-center">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixRows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.query}</td>
                    {row.cells.map((cell, ci) => (
                      <td key={ci} className="rp-td-center">
                        <span
                          className={`rp-matrix-dot ${cell === null ? "is-unknown" : cell ? "is-visible" : "is-danger"}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
