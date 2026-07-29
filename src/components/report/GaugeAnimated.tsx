"use client";

import { useScrollReveal, useRevealCountUp } from "@/lib/useScrollReveal";
import { SIZE, STROKE, RADIUS, CIRCUMFERENCE } from "./GaugeStatic";
import type { GaugeProps } from "./GaugeStatic";

// Animates the ring and the percentage text together, driven by the same
// count-up value, so they never fall out of sync. Zero-visibility renders a
// full ring immediately (no arc to grow from nothing) — see the isZero
// branch in GaugeStatic for the reasoning this mirrors.
export default function GaugeAnimated({ pct, color, caption }: GaugeProps) {
  const { ref, inView, reducedMotion } = useScrollReveal<HTMLDivElement>(0.3);
  const animated = useRevealCountUp(pct, inView, reducedMotion, 500);
  const isZero = pct === 0;
  const filled = isZero ? CIRCUMFERENCE : (animated / 100) * CIRCUMFERENCE;

  return (
    <div ref={ref} className="rp-gauge-col">
      <div style={{ position: "relative", width: SIZE, height: SIZE }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--border)" strokeWidth={STROKE} />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap={animated > 0 ? "round" : "butt"}
            strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: "2rem",
            letterSpacing: "-0.01em",
            color,
          }}
        >
          {animated}%
        </div>
      </div>
      <p className="rp-gauge-caption">{caption}</p>
    </div>
  );
}
