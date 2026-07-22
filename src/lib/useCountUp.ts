"use client";

import { useEffect, useRef, useState } from "react";

// Counts up from 0 to `target` once the returned ref scrolls into view.
// Pure IntersectionObserver + requestAnimationFrame, no animation library.
export function useCountUp<T extends HTMLElement>(target: number, durationMs = 1400) {
  const [value, setValue] = useState(0);
  const ref = useRef<T | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setValue(target);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry.isIntersecting || startedRef.current) return;
        startedRef.current = true;
        observer.disconnect();

        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / durationMs);
          const eased = 1 - Math.pow(1 - progress, 3);
          setValue(Math.round(target * eased));
          if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, durationMs]);

  return { value, ref };
}
