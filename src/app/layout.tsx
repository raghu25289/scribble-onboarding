import type { Metadata } from "next";
import "./globals.css";

// Needed for report pages' OG image tags to resolve to an absolute URL.
// Falls back through an explicit public var, then Vercel's runtime host,
// then localhost for `next dev`.
const siteUrl =
  process.env.NEXT_PUBLIC_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Scribble: See how AI answers about your brand",
  description:
    "Scribble shows whether AI assistants recommend your brand when buyers ask. Enter your site and see who wins your highest-intent queries today.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Funnel Sans is the only typeface app-wide — Arial fallback. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Funnel+Sans:wght@400;500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
