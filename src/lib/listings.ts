import { parseStreetAddress, formatStreetAddress } from "./address.ts"
import { canonicalUrl } from "./canonical.ts"
import type { BusinessListing, DirectoryListing, ListingInput, MapsStatus } from "./types.ts"

export type ListingMapsMatch = {
  placeId?: string
  cid?: string
  title?: string
  address?: string
  phone?: string
  website?: string
  hours?: string
  category?: string
  categories?: string[]
  lat?: number | null
  lng?: number | null
}

export const GOOGLE_BUSINESS_PROFILE_URL = "https://business.google.com"

export const GOOGLE_BUSINESS_PROFILE_LINK_LABEL = "Create a free Google Business Profile"

/** Shared sentence on the public listing and the create/edit form. */
export const GOOGLE_BUSINESS_PROFILE_SIGNIN_NOTE =
  "Be signed in with Gmail or a Google Workspace email before you start."

export function mapsStatusIsNotFound(status: MapsStatus | null | undefined): boolean {
  return status === "not_found"
}

export function mapsNotFoundCtaCopy(): string {
  return "This shop is not on Google Maps yet. Create a free Google Business Profile so neighbors can find it."
}

export function mapsStatusLabel(status: MapsStatus): string {
  if (status === "found") return "Found on Google Maps"
  if (status === "not_found") return "Not found on Google Maps"
  return "Maps check pending"
}

export function mapsStatusDetail(listing: Pick<DirectoryListing, "mapsStatus" | "mapsTitle" | "mapsAddress">): string {
  if (listing.mapsStatus === "found") {
    return listing.mapsAddress
      ? `Matched ${listing.mapsTitle || "this business"} at ${listing.mapsAddress}.`
      : `Matched ${listing.mapsTitle || "this business"} on Google Maps.`
  }
  if (listing.mapsStatus === "not_found") {
    return "This shop is not on Google Maps yet. PlaceFind searched for this name, city, and state and did not find a matching place."
  }
  return "This listing has not been cross-checked on Google Maps yet."
}

export function mapsCategory(place: { category?: string | null; categories?: string[] | null }): string {
  const primary = place.category?.trim() ?? ""
  if (primary) return primary
  return place.categories?.map((row) => row.trim()).find(Boolean) ?? ""
}

export function hoursFromPlace(place: { hours?: string | null; hoursDetail?: { day: string; hours: string }[] | null }): string {
  if (place.hours?.trim()) return place.hours.trim()
  const rows = place.hoursDetail ?? []
  if (rows.length === 0) return ""
  return rows
    .map((row) => `${row.day} ${row.hours}`.trim())
    .filter(Boolean)
    .join("; ")
}

export function listingFormFromPlace(
  place: Pick<BusinessListing, "title" | "address" | "phone" | "website" | "hours" | "hoursDetail" | "category" | "categories"> & {
    city?: string | null
    state?: string | null
  },
  fallback: Partial<ListingInput> = {},
): ListingInput {
  const parsed = parseStreetAddress(place.address ?? "", {
    city: fallback.city || place.city || "",
    state: fallback.state || place.state || "",
  })
  return {
    name: place.title?.trim() || fallback.name?.trim() || "",
    street: parsed.street,
    city: parsed.city || fallback.city?.trim() || place.city?.trim() || "",
    state: parsed.state || fallback.state?.trim() || place.state?.trim() || "",
    zip: parsed.zip || fallback.zip?.trim() || "",
    category: mapsCategory(place) || fallback.category?.trim() || "",
    keywords: fallback.keywords ?? "",
    phone: place.phone?.trim() || fallback.phone?.trim() || "",
    email: fallback.email ?? "",
    website: place.website?.trim() || fallback.website?.trim() || "",
    hours: hoursFromPlace(place) || fallback.hours?.trim() || "",
    yearsInBusiness: fallback.yearsInBusiness ?? "",
    licenseInfo: fallback.licenseInfo ?? "",
    insuranceInfo: fallback.insuranceInfo ?? "",
    priceOptions: fallback.priceOptions ?? "",
    serviceArea: fallback.serviceArea ?? "",
    paymentMethods: fallback.paymentMethods ?? "",
    profilePageTitle: fallback.profilePageTitle ?? "",
    profileMetaDescription: fallback.profileMetaDescription ?? "",
    profileHeadHtml: fallback.profileHeadHtml ?? "",
    profileSchema: fallback.profileSchema ?? "",
    profileHtml: fallback.profileHtml ?? "",
    profileContent: fallback.profileContent ?? "",
    profileH1: fallback.profileH1 ?? "",
    profileH2: fallback.profileH2 ?? "",
    profileH3: fallback.profileH3 ?? "",
    profileH4: fallback.profileH4 ?? "",
    profileH5: fallback.profileH5 ?? "",
    profileH6: fallback.profileH6 ?? "",
  }
}

export function listingMapsMatchFromPlace(place: BusinessListing): ListingMapsMatch {
  return {
    placeId: place.placeId ?? undefined,
    cid: place.cid ?? undefined,
    title: place.title,
    address: place.address,
    phone: place.phone ?? undefined,
    website: place.website ?? undefined,
    hours: hoursFromPlace(place) || undefined,
    category: mapsCategory(place) || undefined,
    categories: place.categories,
    lat: place.lat ?? undefined,
    lng: place.lng ?? undefined,
  }
}

export function mapsSearchCandidates(result: { best: BusinessListing | null; others?: BusinessListing[] }): BusinessListing[] {
  return [result.best, ...(result.others ?? [])].filter((row): row is BusinessListing => Boolean(row))
}

export function slugifyListingPart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

export function listingSlugFromParts(listing: { brand?: string; name?: string; category?: string }): string {
  const brand = slugifyListingPart(listing.brand || listing.name || "")
  const category = slugifyListingPart(listing.category || "")
  if (brand && category && !brand.includes(category)) return `${brand}-${category}`
  return brand || category || "listing"
}

export function listingPath(listing: string | { id: string; slug?: string }): string {
  if (typeof listing === "string") return `/listings/${listing}`
  const slug = listing.slug?.trim()
  return `/listings/${slug || listing.id}`
}

export function listingCanonicalUrl(listing: string | { id: string; slug?: string }): string {
  return canonicalUrl(listingPath(listing))
}

export function isPlaceFindListingUrl(href: string): boolean {
  try {
    const url = new URL(href.trim())
    if (!/^(www\.)?placefind\.to$/i.test(url.hostname)) return false
    const match = url.pathname.match(/^\/listings\/([^/]+)\/?$/)
    return Boolean(match && match[1] && match[1] !== "new")
  } catch {
    return false
  }
}

export function listingRedirectPath(
  requested: string,
  listing: { id: string; slug?: string },
): string | null {
  const slug = listing.slug?.trim() ?? ""
  if (slug && requested === listing.id && requested !== slug) return `/listings/${slug}`
  return null
}

export function listingLocation(
  listing: Pick<DirectoryListing, "city" | "state"> & { street?: string; zip?: string; mapsAddress?: string },
): string {
  const formatted = formatStreetAddress({
    street: listing.street,
    city: listing.city,
    state: listing.state,
    zip: listing.zip,
  })
  const maps = listing.mapsAddress?.trim() ?? ""
  if (listing.street?.trim() && formatted) return formatted
  if (maps) return maps
  return formatted || [listing.city, listing.state].filter(Boolean).join(", ")
}
