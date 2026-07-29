"use client";

import { useScrollReveal, useRevealCountUp } from "@/lib/useScrollReveal";
import { formatNum, type NumFormat } from "@/lib/numFormat";

interface Props {
  value: number;
  format: NumFormat;
  durationMs?: number;
}

// Counts up 0 -> value once scrolled into view, 500ms ease-out. Renders the
// final value immediately under prefers-reduced-motion.
export default function CountUpValue({ value, format, durationMs = 500 }: Props) {
  const { ref, inView, reducedMotion } = useScrollReveal<HTMLSpanElement>(0.3);
  const animated = useRevealCountUp(value, inView, reducedMotion, durationMs);
  return <span ref={ref}>{formatNum(animated, format)}</span>;
}
