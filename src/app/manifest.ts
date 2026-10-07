import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Episodic",
    short_name: "Episodic",
    description: "Your shows, movies, and what to watch next.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    theme_color: "#100f0d",
    background_color: "#100f0d",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      { name: "Up Next", url: "/app" },
      { name: "Calendar", url: "/app/calendar" },
    ],
  };
}
