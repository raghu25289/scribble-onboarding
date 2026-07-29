import Bar from "./Bar";
import type { ReportViewModel } from "@/lib/reportView";

export default function Section02WhereBuyersGo({ view, isStatic }: { view: ReportViewModel; isStatic: boolean }) {
  const { competitorBars } = view;
  if (competitorBars.length === 0) return null;

  return (
    <section className="rp-section">
      <div className="rp-container">
        <span className="rp-index">02</span>
        <h2 className="rp-h2">Where buyers go instead</h2>
        <p className="rp-context">Who AI actually recommends when it doesn&apos;t recommend you.</p>

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
    </section>
  );
}
