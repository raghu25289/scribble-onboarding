"use client";

import { useScrollReveal } from "@/lib/useScrollReveal";
import type { CostBarProps } from "./CostBarStatic";

// Two-layer bar: full loss in --danger, recoverable share overlaid in
// --lime at 60% opacity. Both layers fill together on scroll entry.
export default function CostBarAnimated({ lossPct, recoverablePct }: CostBarProps) {
  const { ref, inView } = useScrollReveal<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className="rp-cost-track">
      <div className="rp-fill-animate rp-cost-fill" style={{ width: inView ? `${lossPct}%` : "0%" }} />
      <div
        className="rp-fill-animate rp-cost-recoverable"
        style={{ width: inView ? `${recoverablePct}%` : "0%" }}
      />
    </div>
  );
}
