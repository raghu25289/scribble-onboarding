import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scribble — See how AI answers about your brand",
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
        {/* Fraunces for the display serif — loaded via Google Fonts CSS. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-stage min-h-screen">{children}</body>
    </html>
  );
}
