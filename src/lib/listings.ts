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

export function listingPath(id: string): string {
  return `/listings/${id}`
}

export function listingLocation(
  listing: Pick<DirectoryListing, "city" | "state"> & { street?: string; zip?: string; mapsAddress?: string },
): string {
  return (
    formatStreetAddress({
      street: listing.street,
      city: listing.city,
      state: listing.state,
      zip: listing.zip,
    }) ||
    listing.mapsAddress?.trim() ||
    [listing.city, listing.state].filter(Boolean).join(", ")
  )
}
