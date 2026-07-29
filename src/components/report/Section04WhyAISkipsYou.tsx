import Bar from "./Bar";
import type { ReportViewModel } from "@/lib/reportView";

export default function Section04WhyAISkipsYou({ view, isStatic }: { view: ReportViewModel; isStatic: boolean }) {
  const { pillars, framingLine } = view;
  if (!pillars) return null;

  return (
    <section className="rp-section">
      <div className="rp-container">
        <span className="rp-index">04</span>
        <h2 className="rp-h2">Why AI skips you</h2>
        <p className="rp-context">The three channels AI actually pulls citations from.</p>

        {pillars.map((p) => (
          <div key={p.id} className="rp-pillar">
            <div className="rp-pillar-row">
              <span>{p.label}</span>
              <span className="rp-pillar-score" style={{ color: p.color }}>
                {p.score}
              </span>
            </div>
            <div className="rp-pillar-track">
              <Bar isStatic={isStatic} pct={Math.max(2, p.score)} className="rp-pillar-fill" background={p.color} />
            </div>
            <p className="rp-pillar-note">{p.note}</p>
          </div>
        ))}

        <p className="rp-framing-line">{framingLine}</p>
      </div>
    </section>
  );
}
