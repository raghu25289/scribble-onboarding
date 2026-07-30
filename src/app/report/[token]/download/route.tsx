import { readFile } from "fs/promises";
import path from "path";
import { store } from "@/lib/store";
import { computeReportViewModel } from "@/lib/reportView";
import Masthead from "@/components/report/Masthead";
import Section01WhereYouStand from "@/components/report/Section01WhereYouStand";
import Section02BuyersAndCosts from "@/components/report/Section02BuyersAndCosts";
import Section04WhyAISkipsYou from "@/components/report/Section04WhyAISkipsYou";
import Section05ThreeMoves from "@/components/report/Section05ThreeMoves";
import CtaFinale from "@/components/report/CtaFinale";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// Vanilla JS equivalent of SlideNav.tsx (the live page's client component):
// same behavior (active-dot tracking via IntersectionObserver, arrow/
// PageUp/PageDown keyboard nav, click-to-jump), hand-written here since the
// download has no React/bundler at all — this is the one inline script the
// self-contained export ships, per the slideshow spec.
const SLIDE_NAV_SCRIPT = `(function () {
  var slides = Array.prototype.slice.call(document.querySelectorAll(".rp-slide"));
  var dots = Array.prototype.slice.call(document.querySelectorAll(".rp-slide-dot"));
  var nav = document.querySelector(".rp-slide-nav");
  if (!slides.length) return;

  var activeIndex = 0;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function setActive(idx) {
    activeIndex = idx;
    dots.forEach(function (d, i) { d.classList.toggle("is-active", i === idx); });
    var isDark = slides[idx] && slides[idx].classList.contains("rp-slide-dark");
    if (nav) nav.classList.toggle("on-dark", !!isDark);
  }

  var observer = new IntersectionObserver(function (entries) {
    var best = null;
    entries.forEach(function (entry) {
      var idx = slides.indexOf(entry.target);
      if (idx === -1 || !entry.isIntersecting) return;
      if (!best || entry.intersectionRatio > best.ratio) best = { idx: idx, ratio: entry.intersectionRatio };
    });
    if (best) setActive(best.idx);
  }, { threshold: [0.5] });
  slides.forEach(function (s) { observer.observe(s); });

  // Update activeIndex optimistically rather than waiting for the
  // IntersectionObserver to confirm the smooth-scroll landed: back-to-back
  // key presses (or dot clicks) fired before the previous scroll settles
  // would otherwise all read the same stale activeIndex and redundantly
  // target the same next slide instead of stacking. The observer still runs
  // and simply reconfirms (or corrects, for manual scrolling) this.
  function goTo(idx) {
    var clamped = Math.max(0, Math.min(slides.length - 1, idx));
    setActive(clamped);
    slides[clamped].scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
  }

  dots.forEach(function (d, i) {
    d.addEventListener("click", function () { goTo(i); });
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "PageDown") {
      e.preventDefault();
      goTo(activeIndex + 1);
    } else if (e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      goTo(activeIndex - 1);
    }
  });
})();`;

// A fully self-contained, static export of the report: all CSS inlined, all
// data baked in at final values. Must render perfectly from a double-click
// on disk with no network — the CTA's booking/email links are plain <a>
// tags (no embed, no third-party script), and this reads report.css raw
// rather than relying on Next's compiled Tailwind bundle, which this page
// doesn't use at all. The one exception to "no JS" is the slideshow nav
// script above, hand-written vanilla JS with no dependencies, needed for
// keyboard nav + the dot indicator to work offline exactly like the live
// page.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const record = await store.getOnboardingByToken(token);
  if (!record || !record.completedAt) {
    return new Response("Report not found", { status: 404 });
  }

  const view = computeReportViewModel(record);
  const css = await readFile(path.join(process.cwd(), "src/app/report.css"), "utf8");

  // Dynamic import: Next's bundler statically blocks a top-level
  // `import ... from "react-dom/server"` in App Router code (it assumes
  // you meant to render a Server Component instead). We genuinely need the
  // real renderToStaticMarkup here to produce one self-contained HTML string
  // for the file download, so the import happens at call time instead.
  const { renderToStaticMarkup } = await import("react-dom/server");

  const bodyMarkup = renderToStaticMarkup(
    <div className="rp-page">
      <div className="rp-slideshow">
        <Masthead view={view} isStatic={true} />
        <Section01WhereYouStand view={view} isStatic={true} />
        <Section02BuyersAndCosts view={view} isStatic={true} />
        <Section04WhyAISkipsYou view={view} isStatic={true} />
        <Section05ThreeMoves view={view} />
        <CtaFinale view={view} />
      </div>
      <nav className="rp-slide-nav" aria-label="Report sections">
        {Array.from({ length: view.slideCount }).map((_, i) => (
          <button key={i} type="button" className={`rp-slide-dot ${i === 0 ? "is-active" : ""}`} aria-label={`Go to slide ${i + 1}`} />
        ))}
      </nav>
    </div>
  );

  const title = `AI Visibility Report: ${view.domain}`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Funnel+Sans:wght@400;500;700;800&display=swap" rel="stylesheet">
<style>${css}</style>
</head>
<body>
${bodyMarkup}
<script>${SLIDE_NAV_SCRIPT}</script>
</body>
</html>
`;

  const dateSlug = record.completedAt.slice(0, 10);
  const filename = `scribble-ai-visibility-${slugify(view.domain)}-${dateSlug}.html`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
