import { listingLocation } from "./listings.ts"
import type { DirectoryListing } from "./types.ts"

export const CRAWL_ARTICLE_FOOTER =
  "This article was written from the listing the owner published and facts found on the business website. Reviews from visitors appear below."

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
    description: listing.profileMetaDescription || undefined,
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

export function listingHasEnhancedProfile(
  listing: Pick<DirectoryListing, "profileContent" | "profileHtml">,
): boolean {
  return Boolean(listing.profileContent?.trim() || listing.profileHtml?.trim())
}

export type ListingProfileFields = {
  profilePageTitle: string
  profileMetaDescription: string
  profileHeadHtml: string
  profileSchema: string
  profileHtml: string
  profileContent: string
}

export function emptyProfileFields(): ListingProfileFields {
  return {
    profilePageTitle: "",
    profileMetaDescription: "",
    profileHeadHtml: "",
    profileSchema: "",
    profileHtml: "",
    profileContent: "",
  }
}

export function listingProfileFromInput(input: Partial<ListingProfileFields> | null | undefined): ListingProfileFields {
  return {
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
      profile.profileContent,
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
    stripCrawlArticleFooter(String(current.profileContent ?? "")) !== next.profileContent
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
  document.title = listingDocumentTitle(listing)

  const added: HTMLElement[] = []
  function add(node: HTMLElement) {
    document.head.appendChild(node)
    added.push(node)
  }

  const description = listing.profileMetaDescription?.trim()
  if (description) {
    const meta = document.createElement("meta")
    meta.setAttribute("name", "description")
    meta.setAttribute("content", description)
    add(meta)
  }

  const schema = parseOwnerSchema(listing.profileSchema ?? "") || defaultListingSchema(listing, pageUrl)
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
      add(child as HTMLElement)
    }
  }

  return () => {
    document.title = previousTitle
    for (const node of added) node.remove()
  }
}
