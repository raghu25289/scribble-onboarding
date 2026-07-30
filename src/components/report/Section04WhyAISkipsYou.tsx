import Bar from "./Bar";
import type { ReportViewModel } from "@/lib/reportView";
import type { PillarId } from "@/lib/types";

// Same illustrative "with Scribble" targets used on the onboarding results
// page's pillar meters — kept in sync there deliberately, not shared via
// import, since the two pages' pillar components don't otherwise touch.
const PILLAR_TARGETS: Record<PillarId, number> = {
  onsite: 70,
  reviews: 65,
  thirdparty: 75,
};

export default function Section04WhyAISkipsYou({ view, isStatic }: { view: ReportViewModel; isStatic: boolean }) {
  const { pillars, framingLine } = view;
  if (!pillars) return null;

  return (
    <section className="rp-slide">
      <div className="rp-container">
        <span className="rp-index">04</span>
        <h2 className="rp-h2">Why AI skips you</h2>
        <p className="rp-context">The three channels AI actually pulls citations from.</p>

        {pillars.map((p) => {
          const target = PILLAR_TARGETS[p.id];
          return (
            <div key={p.id} className="rp-pillar">
              <div className="rp-pillar-row">
                <span>{p.label}</span>
                <span className="rp-pillar-score" style={{ color: p.color }}>
                  {p.score}
                </span>
              </div>
              <div className="rp-pillar-track">
                <div className="rp-pillar-target-ghost" style={{ width: `${target}%` }} />
                <Bar isStatic={isStatic} pct={Math.max(2, p.score)} className="rp-pillar-fill" background={p.color} />
                <div className="rp-pillar-target-marker" style={{ left: `${target}%` }} />
                <span className="rp-pillar-target-label" style={{ left: `${target}%` }}>
                  target
                </span>
              </div>
              <p className="rp-pillar-note">{p.note}</p>
            </div>
          );
        })}

        <p className="rp-framing-line">{framingLine}</p>
      </div>
    </section>
  );
}
