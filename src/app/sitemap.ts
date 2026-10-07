import type { MetadataRoute } from "next";
import { SITE_URL } from "@/components/marketing/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date("2026-10-01");
  const pages: Array<[string, number]> = [
    ["", 1],
    ["/tv-time-alternative", 0.9],
    ["/import-tv-time-data", 0.9],
    ["/pricing", 0.6],
  ];
  return pages.map(([path, priority]) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: "monthly",
    priority,
  }));
}
