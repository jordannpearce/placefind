import { canonicalPath, publicCanonicalOrigin } from "../src/lib/canonical.ts"
import { publicSiteUrl } from "./runtime.ts"

export function siteOrigin(_req?: { protocol?: string; get?: (name: string) => string | undefined }): string {
  return publicSiteUrl()
}

export function robotsTxt(origin: string): string {
  return [
    "# PlaceFind directory. Crawlers are welcome, including scrappey.com.",
    "User-agent: *",
    "Allow: /",
    "",
    "User-agent: Scrappey",
    "Allow: /",
    "",
    "User-agent: scrappey.com",
    "Allow: /",
    "",
    `Sitemap: ${origin.replace(/\/$/, "")}/sitemap.xml`,
    "",
  ].join("\n")
}

export function sitemapXml(origin: string, listingPaths: string[]): string {
  const base = publicCanonicalOrigin(origin)
  const today = new Date().toISOString().slice(0, 10)
  const staticPaths = [
    "/",
    "/directory",
    "/pricing",
    "/join",
    "/create-profile",
    "/terms",
    "/policy",
    "/email-policy",
    "/data-policy",
    "/refund",
  ]
  const urls = [
    ...staticPaths,
    ...listingPaths.map((path) => (path.startsWith("/") ? path : `/listings/${path}`)),
  ].map((path) => canonicalPath(path))
  const body = urls
    .map(
      (path) =>
        `  <url>\n    <loc>${base}${path}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>`,
    )
    .join("\n")
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}
