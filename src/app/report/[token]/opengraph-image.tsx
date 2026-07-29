import { ImageResponse } from "next/og";
import { store } from "@/lib/store";
import { computeHeadlineScore } from "@/lib/engineVisibility";

export const alt = "AI Visibility Report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Raw hex duplicates of globals.css's --miss/--amber/--win tokens: satori
// (what ImageResponse renders through) can't resolve CSS custom properties.
function scoreColor(pct: number): string {
  if (pct < 40) return "#ff6b6b";
  if (pct <= 70) return "#f0b429";
  return "#6ee7a8";
}

// Google Fonts' css2 endpoint serves a TTF (not woff2) to a plain fetch()
// with no Accept header, which is what satori needs. Standard pattern for
// next/og — see Vercel's og-image examples. Never throws; callers fall back
// to a system serif on any failure.
async function loadFraunces(): Promise<ArrayBuffer | null> {
  try {
    const cssRes = await fetch("https://fonts.googleapis.com/css2?family=Fraunces:wght@700", {
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
  const fontData = await loadFraunces();

  const domain = record?.domain ?? "This brand";
  let scorePct = 0;
  if (record) {
    const { visible, total } = computeHeadlineScore(record.visibility);
    scorePct = total > 0 ? Math.round((visible / total) * 100) : 0;
  }

  const fontFamily = fontData ? "Fraunces" : "Georgia, serif";

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
          background:
            "radial-gradient(1200px 600px at 50% -10%, rgba(198,242,78,0.10), transparent 60%), #0a0a0f",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, color: "#9a97a3", letterSpacing: 2 }}>
          SCRIBBLE · AI VISIBILITY REPORT
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 56,
            fontFamily,
            color: "#f4f1ea",
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
              fontWeight: 700,
              fontFamily,
              color: scoreColor(scorePct),
            }}
          >
            {scorePct}%
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 8, fontSize: 32, color: "#9a97a3" }}>
          of AI answers mention {domain}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData ? [{ name: "Fraunces", data: fontData, weight: 700, style: "normal" }] : [],
    }
  );
}
