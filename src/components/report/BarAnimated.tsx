"use client";

import { useScrollReveal } from "@/lib/useScrollReveal";
import type { BarProps } from "./BarStatic";

// Fills from 0 to pct on scroll entry, 500ms ease-out (.rp-fill-animate
// carries the transition). Used for competitor counts and pillar meters.
export default function BarAnimated({ pct, className, background }: BarProps) {
  const { ref, inView } = useScrollReveal<HTMLDivElement>(0.3);
  return (
    <div
      ref={ref}
      className={`rp-fill-animate ${className}`}
      style={{ width: inView ? `${pct}%` : "0%", background }}
    />
  );
}
