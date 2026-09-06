export type SiteFacts = {
  brand: string
  licenseInfo: string
  yearsInBusiness: string
  specialty: string
}

const LICENSE_RE =
  /(?:license(?:\s*(?:no\.?|number|#))?|lic(?:ense)?\s*#)\s*[:#]?\s*([A-Z0-9][A-Z0-9-]{3,24})/i
const SINCE_RE = /(?:since|est\.?|established|founded|opened)\s+(?:in\s+)?((?:19|20)\d{2})/i
const YEARS_RE = /(\d{1,3})\s+years?\s+(?:in business|of experience|serving)/i
const SPECIALTY_RE =
  /specializ(?:e|es|ing)\s+in\s+([^.!\n]{8,140})|we (?:are|offer|provide|focus on)\s+([^.!\n]{8,140})/i

function firstHeading(markdown: string): string {
  const match = markdown.match(/^#{1,3}\s+(.+)$/m)
  return match?.[1]?.replace(/[*_`]/g, "").trim() ?? ""
}

function firstTitle(markdown: string): string {
  const match = markdown.match(/^title:\s*(.+)$/im)
  return match?.[1]?.trim() ?? ""
}

export function parseSitemapLocs(xml: string): string[] {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((row) => row[1]!.trim())
  const seen = new Set<string>()
  const unique: string[] = []
  for (const loc of locs) {
    try {
      const url = new URL(loc).href
      if (seen.has(url)) continue
      seen.add(url)
      unique.push(url)
    } catch {
      continue
    }
  }
  return unique
}

export function isSitemapDocument(xml: string): boolean {
  return /<(sitemapindex|urlset)[\s>]/i.test(xml)
}

export function parseSitemapDocument(xml: string): { pages: string[]; nested: string[] } {
  const locs = parseSitemapLocs(xml)
  if (/<sitemapindex[\s>]/i.test(xml)) return { pages: [], nested: locs }
  const nested = locs.filter((loc) => /sitemap/i.test(loc) || /\.xml(?:$|\?)/i.test(loc))
  const pages = locs.filter((loc) => !nested.includes(loc))
  return { pages, nested }
}

export function extractPageTitle(markdown: string): string {
  return firstTitle(markdown) || firstHeading(markdown)
}

export function extractPageSnippet(markdown: string, max = 220): string {
  const text = markdown
    .replace(/\r/g, "")
    .replace(/^title:\s*.+$/gim, "")
    .replace(/^#{1,6}\s+.+$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`*_>#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  if (!text) return ""
  return text.length > max ? `${text.slice(0, max).trim()}…` : text
}

export function extractSameOriginLinks(content: string, pageUrl: string): string[] {
  let origin = ""
  try {
    origin = new URL(pageUrl).origin
  } catch {
    return []
  }
  const raw = [
    ...content.matchAll(/href=["']([^"']+)["']/gi),
    ...content.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g),
    ...content.matchAll(/\bhttps?:\/\/[^\s"'<>)\]]+/gi),
  ].map((row) => row[1] || row[0])
  const seen = new Set<string>()
  const links: string[] = []
  for (const href of raw) {
    try {
      const url = new URL(href, pageUrl)
      if (url.origin !== origin) continue
      url.hash = ""
      const normalized = url.href
      if (seen.has(normalized)) continue
      seen.add(normalized)
      links.push(normalized)
    } catch {
      continue
    }
  }
  return links
}

export function extractSiteFacts(markdown: string, fallbackName = ""): SiteFacts {
  const text = markdown.replace(/\r/g, "")
  const license = text.match(LICENSE_RE)?.[1]?.trim() ?? ""
  const since = text.match(SINCE_RE)?.[1]
  const yearsCount = text.match(YEARS_RE)?.[1]
  const yearsInBusiness = since
    ? `Since ${since}`
    : yearsCount
      ? `${yearsCount} years in business`
      : ""
  const specialtyMatch = text.match(SPECIALTY_RE)
  const specialty = (specialtyMatch?.[1] || specialtyMatch?.[2] || "").replace(/\s+/g, " ").trim()
  const brand = firstTitle(text) || firstHeading(text) || fallbackName
  return {
    brand: brand.slice(0, 120),
    licenseInfo: license ? `License ${license}` : "",
    yearsInBusiness,
    specialty: specialty.slice(0, 160),
  }
}

export function mergeSiteFacts(pages: string[], fallbackName = ""): SiteFacts {
  const merged = pages.map((page) => extractSiteFacts(page, fallbackName))
  const first = (pick: (row: SiteFacts) => string) => merged.map(pick).find((value) => value.trim()) ?? ""
  return {
    brand: first((row) => row.brand) || fallbackName,
    licenseInfo: first((row) => row.licenseInfo),
    yearsInBusiness: first((row) => row.yearsInBusiness),
    specialty: first((row) => row.specialty),
  }
}

export function writeProfileArticle(
  facts: SiteFacts,
  listing: { name: string; city: string; state: string; category?: string },
): string {
  const name = facts.brand || listing.name
  const place = [listing.city, listing.state].filter(Boolean).join(", ")
  const category = listing.category?.trim() || "local business"
  const years = facts.yearsInBusiness ? ` ${facts.yearsInBusiness.replace(/^Since /, "The shop has been open since ")}.` : ""
  const license = facts.licenseInfo ? ` ${facts.licenseInfo} is on file.` : ""
  const specialty = facts.specialty
    ? ` ${name} specializes in ${facts.specialty.replace(/^we (?:are|offer|provide|focus on)\s+/i, "")}.`
    : ""

  const lead = `${name} is a ${category} in ${place || "the directory"}.${years}${license}`
  const middle = specialty
    ? specialty.trim()
    : `${name} is listed in the PlaceFind directory so neighbors and other businesses can find a clear profile, hours, and contact details in one place.`
  const close = `This profile was written from the business website and the listing the owner published on PlaceFind. Reviews from visitors appear below the facts.`
  return [lead.trim(), middle.trim(), close].filter(Boolean).join("\n\n")
}
