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
    theme_color: "#f25c2a",
    orientation: "portrait",
    icons: [
      {
        src: "/icons/pulse.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
