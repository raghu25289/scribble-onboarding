import { ImageResponse } from "next/og";
import { store } from "@/lib/store";
import { computeHeadlineScore } from "@/lib/engineVisibility";

export const alt = "AI Visibility Report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Raw hex duplicates of report.css's --danger/--ink/--lime-deep tokens:
// satori (what ImageResponse renders through) can't resolve CSS custom
// properties or color-mix(), so this image is the one place those values
// get hardcoded.
function scoreColor(pct: number): string {
  if (pct < 40) return "#e5484d";
  if (pct <= 70) return "#171717";
  return "#4bae00";
}

// Google Fonts' css2 endpoint serves a TTF (not woff2) to a plain fetch()
// with no Accept header, which is what satori needs. Standard pattern for
// next/og — see Vercel's og-image examples. Never throws; callers fall back
// to a system sans on any failure.
async function loadFunnelSans(): Promise<ArrayBuffer | null> {
  try {
    const cssRes = await fetch("https://fonts.googleapis.com/css2?family=Funnel+Sans:wght@800", {
      cache: "force-cache",
    });
    const css = await cssRes.text();
    const match = css.match(/src: url\(([^)]+)\) format\('(?:opentype|truetype)'\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const record = await store.getOnboardingByToken(token);
  const fontData = await loadFunnelSans();

  const domain = record?.domain ?? "This brand";
  let scorePct = 0;
  if (record) {
    const { visible, total } = computeHeadlineScore(record.visibility);
    scorePct = total > 0 ? Math.round((visible / total) * 100) : 0;
  }

  const fontFamily = fontData ? "Funnel Sans" : "Arial, sans-serif";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#ffffff",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, color: "rgba(23,23,23,0.45)", letterSpacing: 2 }}>
          SCRIBBLE · AI VISIBILITY REPORT
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 56,
            fontFamily,
            fontWeight: 800,
            color: "#171717",
            letterSpacing: -1,
          }}
        >
          {domain}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", marginTop: 36 }}>
          <div
            style={{
              display: "flex",
              fontSize: 200,
              fontWeight: 800,
              fontFamily,
              color: scoreColor(scorePct),
            }}
          >
            {scorePct}%
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 8, fontSize: 30, color: "rgba(23,23,23,0.45)" }}>
          of AI answers mention {domain}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData ? [{ name: "Funnel Sans", data: fontData, weight: 800, style: "normal" }] : [],
    }
  );
}
