"use client";

import { useEffect, useRef, useState } from "react";

// Right-edge progress dots + keyboard nav (arrows, PageUp/PageDown) for the
// slideshow. Reads .rp-slide elements directly from the DOM rather than
// threading refs down through every section, since the set of rendered
// slides is exactly what page.tsx already decided via slideCount.
export default function SlideNav({ slideCount }: { slideCount: number }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDark, setIsDark] = useState(false);
  const indexRef = useRef(0);
  const slidesRef = useRef<HTMLElement[]>([]);
  const reducedMotionRef = useRef(false);

  const setActive = (idx: number) => {
    const slides = slidesRef.current;
    indexRef.current = idx;
    setActiveIndex(idx);
    setIsDark(slides[idx]?.classList.contains("rp-slide-dark") ?? false);
  };

  // Update indexRef/UI optimistically rather than waiting for the
  // IntersectionObserver to confirm the smooth-scroll landed: back-to-back
  // key presses (or dot clicks) fired before the previous scroll settles
  // would otherwise all read the same stale indexRef and redundantly target
  // the same next slide instead of stacking. The observer still runs and
  // simply reconfirms (or corrects, for manual trackpad/wheel scrolling)
  // this.
  function goTo(idx: number) {
    const slides = slidesRef.current;
    const clamped = Math.max(0, Math.min(slides.length - 1, idx));
    setActive(clamped);
    slides[clamped]?.scrollIntoView({ behavior: reducedMotionRef.current ? "auto" : "smooth", block: "start" });
  }

  useEffect(() => {
    const slides = Array.from(document.querySelectorAll<HTMLElement>(".rp-slide"));
    slidesRef.current = slides;
    if (slides.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestIdx = -1;
        let bestRatio = -1;
        for (const entry of entries) {
          const idx = slides.indexOf(entry.target as HTMLElement);
          if (idx === -1 || !entry.isIntersecting) continue;
          if (entry.intersectionRatio > bestRatio) {
            bestIdx = idx;
            bestRatio = entry.intersectionRatio;
          }
        }
        if (bestIdx !== -1) setActive(bestIdx);
      },
      { threshold: [0.5] }
    );
    slides.forEach((s) => observer.observe(s));

    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        goTo(indexRef.current + 1);
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        goTo(indexRef.current - 1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      observer.disconnect();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleDotClick(idx: number) {
    goTo(idx);
  }

  return (
    <nav className={`rp-slide-nav ${isDark ? "on-dark" : ""}`} aria-label="Report sections">
      {Array.from({ length: slideCount }).map((_, i) => (
        <button
          key={i}
          type="button"
          className={`rp-slide-dot ${i === activeIndex ? "is-active" : ""}`}
          aria-label={`Go to slide ${i + 1}`}
          onClick={() => handleDotClick(i)}
        />
      ))}
    </nav>
  );
}
