"use client";

import { useEffect, useRef, useState } from "react";
import { useScrollReveal } from "@/lib/useScrollReveal";
import { bandColor } from "@/lib/severity";

// Counts up 0 -> 100 in green (hope), holds a beat, then drains to the real
// score while the color falls to whatever band it actually lands in. All
// timings stay under the spec's 700ms-per-beat budget.
const RISE_MS = 600;
const HOLD_MS = 300;
const FALL_MS = 600;

interface Props {
  domain: string;
  scorePct: number;
  buyerVolume: number;
}

export default function ReportHero({ domain, scorePct, buyerVolume }: Props) {
  const { ref, inView, reducedMotion } = useScrollReveal<HTMLElement>(0.5);
  const [value, setValue] = useState(reducedMotion ? scorePct : 0);
  const [falling, setFalling] = useState(reducedMotion);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!inView || startedRef.current) return;
    startedRef.current = true;

    if (reducedMotion) {
      setValue(scorePct);
      setFalling(true);
      return;
    }

    let rafId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const animate = (from: number, to: number, duration: number, onDone?: () => void) => {
      const start = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(from + (to - from) * eased));
        if (progress < 1) {
          rafId = requestAnimationFrame(tick);
        } else {
          onDone?.();
        }
      };
      rafId = requestAnimationFrame(tick);
    };

    animate(0, 100, RISE_MS, () => {
      timeoutId = setTimeout(() => {
        if (cancelled) return;
        setFalling(true);
        animate(100, scorePct, FALL_MS);
      }, HOLD_MS);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [inView, reducedMotion, scorePct]);

  const color = falling ? bandColor(scorePct) : "var(--win)";

  return (
    <section
      ref={ref}
      className="report-section flex min-h-screen flex-col items-center justify-center px-6 text-center"
    >
      <h1 className="font-display text-4xl font-semibold sm:text-6xl">{domain}</h1>
      <div
        className="font-display mt-4 text-8xl font-bold tabular-nums sm:text-9xl"
        style={{ color, transition: `color ${FALL_MS}ms ease-out` }}
      >
        {value}%
      </div>
      <p className="mt-4 max-w-md text-lg text-[var(--muted)]">
        of AI answers in your category mention you.
      </p>
      <p className="mt-6 text-sm text-[var(--muted)]">
        {buyerVolume.toLocaleString("en-US")}{" "}
        buyers a month are asking. Here&apos;s who AI sends them to.
      </p>
    </section>
  );
}
