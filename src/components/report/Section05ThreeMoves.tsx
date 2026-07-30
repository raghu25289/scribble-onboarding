import type { ReportViewModel } from "@/lib/reportView";
import type { ReportMoveImpact } from "@/lib/types";

const IMPACT_LABELS: Record<ReportMoveImpact, string> = {
  high_leverage: "High leverage",
  fast_win: "Fast win",
  compounding: "Compounding",
};

export default function Section05ThreeMoves({ view }: { view: ReportViewModel }) {
  const { moves } = view;
  if (!moves) return null;

  return (
    <section className="rp-slide">
      <div className="rp-container">
        <span className="rp-index">05</span>
        <h2 className="rp-h2">Three moves that change this fastest</h2>
        <p className="rp-context">Specific to your actual gaps, not generic advice.</p>
      </div>

      <div className="rp-wide">
        <div className="rp-moves">
          {moves.map((move, i) => (
            <div key={i} className="rp-move-card">
              <span className="rp-move-index">{i + 1}</span>
              <p className="rp-move-title">{move.title}</p>
              <p className="rp-move-body">{move.description}</p>
              <span className="rp-impact-chip">{IMPACT_LABELS[move.impact]}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
