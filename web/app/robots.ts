import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/cards/", "/api/cron/", "/api/x/", "/api/grades"] }], sitemap: "https://purpledinos.ca/sitemap.xml", host: "https://purpledinos.ca" };
}
