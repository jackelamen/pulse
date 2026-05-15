import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { getPublicPulseEnv } from "@/lib/env";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  title: {
    default: "Pulse",
    template: "%s — Pulse",
  },
  description: "Tasks, calendar, focus, habits. The Tasks module of TheEDGEx.",
  icons: {
    icon: "/icons/pulse.svg",
    apple: "/icons/pulse.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pulse",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1020" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const publicEnv = getPublicPulseEnv();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="pulse-runtime-env"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.__PULSE_ENV__=${JSON.stringify(publicEnv)};`,
          }}
        />
      </head>
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
