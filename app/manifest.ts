import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pulse",
    short_name: "Pulse",
    description: "Tasks, calendar, focus, and habits for TheEDGEx.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    background_color: "#f8f9fc",
    theme_color: "#7c3aed",
    orientation: "portrait",
    icons: [
      // "any" icons carry macOS-style safe-area padding so the installed
      // desktop/dock icon matches the size of native app icons.
      {
        src: "/icons/pulse-192.png?v=6",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/pulse-512.png?v=6",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Maskable icon stays full-bleed so Android adaptive icons fill their mask.
      {
        src: "/icons/pulse-maskable-512.png?v=6",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
