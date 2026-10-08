import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const pages = [
    "",
    "/find-donors",
    "/become-donor",
    "/emergency",
    "/camps",
    "/organizations",
    "/about",
    "/login",
    "/dashboard",
    "/admin",
  ];
  return pages.map((p) => ({
    url: `${base}${p}`,
    lastModified: new Date(),
    changeFrequency: p === "" || p === "/emergency" ? "hourly" : "weekly",
    priority: p === "" ? 1 : p === "/become-donor" || p === "/emergency" || p === "/find-donors" ? 0.9 : 0.7,
  }));
}
