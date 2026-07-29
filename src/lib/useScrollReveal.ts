"use client";

import { useEffect, useRef, useState } from "react";

// Generalized version of useCountUp: fires once when the ref scrolls into
// view, no animation library. Callers drive their own CSS transitions/RAF
// loops off `inView` — this hook only owns the "has this entered the
// viewport yet" question, plus prefers-reduced-motion detection.
//
// When reduced motion is on, `inView` is true from the first render so
// callers render straight at final values instead of racing a real
// animation to its own end state.
export function useScrollReveal<T extends HTMLElement>(threshold = 0.35) {
  const ref = useRef<T | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setInView(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion, threshold]);

  return { ref, inView, reducedMotion };
}

// A count-up driven by an externally-owned trigger (e.g. one shared
// useScrollReveal for a whole grid of tiles) rather than its own
// IntersectionObserver. Starts once when `trigger` flips true, runs once,
// and renders straight at `target` under reduced motion — same contract as
// useCountUp, but decoupled from viewport observation.
export function useRevealCountUp(
  target: number,
  trigger: boolean,
  reducedMotion: boolean,
  durationMs = 600
): number {
  const [value, setValue] = useState(reducedMotion ? target : 0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (reducedMotion) {
      setValue(target);
      return;
    }
    if (!trigger || startedRef.current) return;
    startedRef.current = true;

    let rafId = 0;
    let cancelled = false;
    const start = performance.now();
    const tick = (now: number) => {
      if (cancelled) return;
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [trigger, reducedMotion, target, durationMs]);

  return value;
}
