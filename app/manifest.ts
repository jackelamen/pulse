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
      {
        src: "/icons/pulse.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/pulse.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
