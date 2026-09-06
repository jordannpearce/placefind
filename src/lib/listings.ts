import { formatStreetAddress } from "./address.ts"
import type { DirectoryListing, MapsStatus } from "./types.ts"

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
    return "PlaceFind searched Google Maps for this name, city, and state and did not find a matching place."
  }
  return "This listing has not been cross-checked on Google Maps yet."
}

export function mapsCategory(place: { category?: string | null; categories?: string[] | null }): string {
  const primary = place.category?.trim() ?? ""
  if (primary) return primary
  return place.categories?.map((row) => row.trim()).find(Boolean) ?? ""
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
