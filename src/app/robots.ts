import type { MetadataRoute } from "next";
import { SITE_URL } from "@/components/marketing/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/app/", "/api/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
