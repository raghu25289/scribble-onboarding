export interface CostBarProps {
  lossPct: number;
  recoverablePct: number;
}

export default function CostBarStatic({ lossPct, recoverablePct }: CostBarProps) {
  return (
    <div className="rp-cost-track">
      <div className="rp-cost-fill" style={{ width: `${lossPct}%` }} />
      <div className="rp-cost-recoverable" style={{ width: `${recoverablePct}%` }} />
    </div>
  );
}
