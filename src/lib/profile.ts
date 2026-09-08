import { applyDocumentCanonical, canonicalUrl, isCanonicalLinkElement, upsertHtmlCanonical } from "./canonical.ts"
import { listingLocation, listingPath } from "./listings.ts"
import type { DirectoryListing } from "./types.ts"

export const CRAWL_ARTICLE_FOOTER =
  "This article was written from the listing the owner published and facts found on the business website. Reviews from visitors appear below."

export const DEFAULT_SITE_DESCRIPTION =
  "PlaceFind is a web directory for local businesses. List a shop for $150 per month."

const CRAWL_FOOTER_PATTERNS = [
  /(?:\n\n)?This article was written from the listing the owner published and facts found on the business website\.\s*Reviews from visitors appear below\.?/gi,
  /(?:\n\n)?This profile was written from the business website and the listing the owner published on PlaceFind\.\s*Reviews from visitors appear below the facts\.?/gi,
]

const EVENT_ATTR = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi
const DANGEROUS_TAGS = /<\/?(?:script|iframe|object|embed|link|meta|form|input|button|textarea|select|option|base|html|head|body|frameset|frame)\b[^>]*>/gi

export function stripCrawlArticleFooter(text: string): string {
  let next = text
  for (const pattern of CRAWL_FOOTER_PATTERNS) {
    next = next.replace(pattern, "")
  }
  return next.replace(/\n{3,}/g, "\n\n").trim()
}

export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value)
}

export function sanitizeOwnerHtml(html: string, max = 100_000): string {
  return html
    .slice(0, max)
    .replace(/<(script|iframe|object|embed|form|textarea|select)\b[\s\S]*?<\/\1>/gi, "")
    .replace(DANGEROUS_TAGS, "")
    .replace(EVENT_ATTR, "")
    .replace(/\s(?:href|src)\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, ' $1="#"')
    .trim()
}

export function sanitizeOwnerHeadHtml(html: string, max = 8_000): string {
  const allowed = html
    .slice(0, max)
    .replace(EVENT_ATTR, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
  const tags = [
    ...allowed.matchAll(/<(meta|link)\b([^>]*)\/?>/gi),
    ...allowed.matchAll(/<(style|title)\b([^>]*)>([\s\S]*?)<\/\1>/gi),
  ]
  return tags
    .map((match) => {
      const name = match[1]!.toLowerCase()
      const attrs = (match[2] ?? "").replace(EVENT_ATTR, "")
      if (name === "meta" || name === "link") return `<${name}${attrs}>`
      return `<${name}${attrs}>${match[3] ?? ""}</${name}>`
    })
    .join("\n")
    .trim()
}

export function parseOwnerSchema(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ""
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || typeof parsed !== "object") return ""
    return JSON.stringify(parsed)
  } catch {
    return ""
  }
}

export function defaultListingSchema(listing: DirectoryListing, pageUrl?: string): string {
  const address = {
    "@type": "PostalAddress",
    streetAddress: listing.street || undefined,
    addressLocality: listing.city || undefined,
    addressRegion: listing.state || undefined,
    postalCode: listing.zip || undefined,
  }
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: listing.brand || listing.name,
    description: listingDocumentDescription(listing),
    telephone: listing.phone || undefined,
    url: listing.website || pageUrl || undefined,
    address,
  }
  return JSON.stringify(data)
}

export function listingDocumentTitle(listing: DirectoryListing): string {
  const custom = listing.profilePageTitle?.trim()
  if (custom) return custom
  const name = listing.brand || listing.name
  const place = listingLocation(listing)
  return place ? `${name} · ${place}` : `${name} · PlaceFind`
}

export const PROFILE_HEADING_LEVELS = [1, 2, 3, 4, 5, 6] as const
export type ProfileHeadingLevel = (typeof PROFILE_HEADING_LEVELS)[number]
export type ProfileHeadingFields = {
  [K in ProfileHeadingLevel as `profileH${K}`]: string
}

export function emptyHeadingFields(): ProfileHeadingFields {
  return {
    profileH1: "",
    profileH2: "",
    profileH3: "",
    profileH4: "",
    profileH5: "",
    profileH6: "",
  }
}

export function listingProfileHeadings(
  listing: Partial<ProfileHeadingFields> | null | undefined,
): { level: ProfileHeadingLevel; text: string }[] {
  return PROFILE_HEADING_LEVELS.flatMap((level) => {
    const text = String(listing?.[`profileH${level}`] ?? "").trim()
    return text ? [{ level, text }] : []
  })
}

export function listingBusinessName(
  listing: Pick<DirectoryListing, "name"> & { brand?: string },
): string {
  return listing.brand?.trim() || listing.name
}

export function listingDocumentDescription(
  listing: Pick<DirectoryListing, "name" | "city" | "state"> & {
    brand?: string
    profileMetaDescription?: string
  },
): string {
  const custom = listing.profileMetaDescription?.trim()
  if (custom) return custom
  const name = listingBusinessName(listing)
  const place = [listing.city?.trim(), listing.state?.trim()].filter(Boolean).join(", ")
  return place ? `${name} in ${place}.` : `${name} on PlaceFind.`
}

export function escapeOwnerText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function upsertHtmlMeta(html: string, attr: "name" | "property", key: string, content: string, id: string): string {
  const escaped = escapeOwnerText(content)
  const pattern = new RegExp(`<meta\\b[^>]*?\\b${attr}\\s*=\\s*["']${escapeRegExp(key)}["'][^>]*>`, "is")
  const tag = `<meta id="${id}" ${attr}="${key}" content="${escaped}">`
  if (pattern.test(html)) return html.replace(pattern, tag)
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`)
}

export function listingCanonicalHref(
  listing: Pick<DirectoryListing, "id"> & { slug?: string },
  pageUrl?: string,
  origin?: string | null,
): string {
  return canonicalUrl(pageUrl || listingPath(listing), origin)
}

export function applyListingHtmlHead(
  html: string,
  listing: DirectoryListing,
  pageUrl?: string,
  origin?: string | null,
): string {
  const title = listingDocumentTitle(listing)
  const description = listingDocumentDescription(listing)
  const href = listingCanonicalHref(listing, pageUrl, origin)
  let next = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeOwnerText(title)}</title>`)
  next = upsertHtmlMeta(next, "name", "description", description, "placefind-description")
  next = upsertHtmlMeta(next, "property", "og:description", description, "placefind-og-description")
  next = upsertHtmlMeta(next, "property", "og:title", title, "placefind-og-title")
  next = upsertHtmlMeta(next, "property", "og:url", href, "placefind-og-url")
  return upsertHtmlCanonical(next, href)
}

function upsertDocumentMeta(id: string, attr: "name" | "property", key: string, content: string): () => void {
  const existing =
    document.getElementById(id) ?? document.head.querySelector(`meta[${attr}="${key}"]`)
  if (existing) {
    const previous = existing.getAttribute("content")
    const previousId = existing.getAttribute("id")
    existing.setAttribute("content", content)
    if (!previousId) existing.setAttribute("id", id)
    return () => {
      if (previous == null) existing.removeAttribute("content")
      else existing.setAttribute("content", previous)
      if (!previousId) existing.removeAttribute("id")
    }
  }
  const meta = document.createElement("meta")
  meta.setAttribute("id", id)
  meta.setAttribute(attr, key)
  meta.setAttribute("content", content)
  document.head.appendChild(meta)
  return () => meta.remove()
}

export function renderProfileArticle(text: string): string {
  const trimmed = stripCrawlArticleFooter(text)
  if (!trimmed) return ""
  if (looksLikeHtml(trimmed)) return sanitizeOwnerHtml(trimmed)
  return sanitizeOwnerHtml(
    trimmed
      .split(/\n{2,}/)
      .map((block) => {
        const heading = block.match(/^(#{1,6})\s+(.+)$/)
        if (heading) {
          const level = heading[1]!.length
          return `<h${level}>${escapeOwnerText(heading[2]!.trim())}</h${level}>`
        }
        return `<p>${escapeOwnerText(block).replace(/\n/g, "<br>")}</p>`
      })
      .join("\n"),
  )
}

export function listingHasEnhancedProfile(
  listing: Pick<DirectoryListing, "profileContent" | "profileHtml"> & Partial<ProfileHeadingFields>,
): boolean {
  return Boolean(
    listing.profileContent?.trim() ||
      listing.profileHtml?.trim() ||
      listingProfileHeadings(listing).length > 0,
  )
}

export type ListingProfileFields = ProfileHeadingFields & {
  profilePageTitle: string
  profileMetaDescription: string
  profileHeadHtml: string
  profileSchema: string
  profileHtml: string
  profileContent: string
}

export function emptyProfileFields(): ListingProfileFields {
  return {
    ...emptyHeadingFields(),
    profilePageTitle: "",
    profileMetaDescription: "",
    profileHeadHtml: "",
    profileSchema: "",
    profileHtml: "",
    profileContent: "",
  }
}

function headingFieldsFromInput(input: Partial<ProfileHeadingFields> | null | undefined): ProfileHeadingFields {
  const next = emptyHeadingFields()
  for (const level of PROFILE_HEADING_LEVELS) {
    next[`profileH${level}`] = String(input?.[`profileH${level}`] ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 200)
  }
  return next
}

export function listingProfileFromInput(input: Partial<ListingProfileFields> | null | undefined): ListingProfileFields {
  return {
    ...headingFieldsFromInput(input),
    profilePageTitle: String(input?.profilePageTitle ?? "").trim(),
    profileMetaDescription: String(input?.profileMetaDescription ?? "").trim(),
    profileHeadHtml: sanitizeOwnerHeadHtml(input?.profileHeadHtml ?? ""),
    profileSchema: String(input?.profileSchema ?? "").trim(),
    profileHtml: sanitizeOwnerHtml(input?.profileHtml ?? ""),
    profileContent: stripCrawlArticleFooter(String(input?.profileContent ?? "")),
  }
}

export function profileHasOwnerCopy(profile: ListingProfileFields): boolean {
  return Boolean(
    profile.profilePageTitle ||
      profile.profileMetaDescription ||
      profile.profileHeadHtml ||
      profile.profileSchema ||
      profile.profileHtml ||
      profile.profileContent ||
      listingProfileHeadings(profile).length,
  )
}

export function profileFieldsChanged(
  current: Partial<ListingProfileFields>,
  next: ListingProfileFields,
): boolean {
  return (
    String(current.profilePageTitle ?? "") !== next.profilePageTitle ||
    String(current.profileMetaDescription ?? "") !== next.profileMetaDescription ||
    String(current.profileHeadHtml ?? "") !== next.profileHeadHtml ||
    String(current.profileSchema ?? "") !== next.profileSchema ||
    String(current.profileHtml ?? "") !== next.profileHtml ||
    stripCrawlArticleFooter(String(current.profileContent ?? "")) !== next.profileContent ||
    PROFILE_HEADING_LEVELS.some((level) => String(current[`profileH${level}`] ?? "") !== next[`profileH${level}`])
  )
}

export function profileSchemaError(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return "Schema must be a JSON object."
    }
    return undefined
  } catch {
    return "Schema must be valid JSON."
  }
}

export function applyListingDocumentHead(listing: DirectoryListing, pageUrl?: string): () => void {
  if (typeof document === "undefined") return () => undefined
  const previousTitle = document.title
  const title = listingDocumentTitle(listing)
  document.title = title

  const added: HTMLElement[] = []
  function add(node: HTMLElement) {
    document.head.appendChild(node)
    added.push(node)
  }

  const description = listingDocumentDescription(listing)
  const href = listingCanonicalHref(listing, pageUrl)
  const restores = [
    () => {
      document.title = previousTitle
    },
    upsertDocumentMeta("placefind-description", "name", "description", description),
    upsertDocumentMeta("placefind-og-description", "property", "og:description", description),
    upsertDocumentMeta("placefind-og-title", "property", "og:title", title),
    upsertDocumentMeta("placefind-og-url", "property", "og:url", href),
  ]

  const schema = parseOwnerSchema(listing.profileSchema ?? "") || defaultListingSchema(listing, href)
  if (schema) {
    const script = document.createElement("script")
    script.type = "application/ld+json"
    script.textContent = schema
    add(script)
  }

  const headHtml = sanitizeOwnerHeadHtml(listing.profileHeadHtml ?? "")
  if (headHtml) {
    const holder = document.createElement("div")
    holder.innerHTML = headHtml
    for (const child of [...holder.children]) {
      if (isCanonicalLinkElement(child as HTMLElement)) continue
      add(child as HTMLElement)
    }
  }
  restores.push(applyDocumentCanonical(href))
  return () => {
    for (const restore of restores.reverse()) restore()
    for (const node of added) node.remove()
  }
}
