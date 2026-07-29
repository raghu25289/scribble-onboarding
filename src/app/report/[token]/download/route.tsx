import { readFile } from "fs/promises";
import path from "path";
import { store } from "@/lib/store";
import { computeReportViewModel } from "@/lib/reportView";
import Masthead from "@/components/report/Masthead";
import KeyFindingsStrip from "@/components/report/KeyFindingsStrip";
import Section01WhereYouStand from "@/components/report/Section01WhereYouStand";
import Section02WhereBuyersGo from "@/components/report/Section02WhereBuyersGo";
import Section03WhatItCosts from "@/components/report/Section03WhatItCosts";
import Section04WhyAISkipsYou from "@/components/report/Section04WhyAISkipsYou";
import Section05ThreeMoves from "@/components/report/Section05ThreeMoves";
import CtaFinaleStatic from "@/components/report/CtaFinaleStatic";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// A fully self-contained, static export of the report: all CSS inlined, all
// data baked in at final values, zero JS. Must render perfectly from a
// double-click on disk with no network — so it never touches the Cal.com
// embed (see CtaFinaleStatic) and reads report.css raw rather than relying
// on Next's compiled Tailwind bundle, which this page doesn't use at all.
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
      <Masthead domain={view.domain} completedAt={view.completedAt} category={view.category} />
      <KeyFindingsStrip view={view} isStatic={true} />
      <Section01WhereYouStand view={view} isStatic={true} />
      <Section02WhereBuyersGo view={view} isStatic={true} />
      <Section03WhatItCosts view={view} isStatic={true} />
      <Section04WhyAISkipsYou view={view} isStatic={true} />
      <Section05ThreeMoves view={view} />
      <CtaFinaleStatic view={view} />
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
