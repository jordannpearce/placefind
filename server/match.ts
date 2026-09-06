import { toStateAbbr, toStateName } from "./states.ts"
import type { BusinessListing, SearchQuery } from "./types.ts"

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(normalizeName(left).split(" ").filter((token) => token.length > 2))
  const rightTokens = normalizeName(right).split(" ").filter((token) => token.length > 2)
  if (rightTokens.length === 0) return 0
  const hit = rightTokens.filter((token) => leftTokens.has(token)).length
  return hit / rightTokens.length
}

export function namesMatch(listingTitle: string, target: string): boolean {
  const listing = normalizeName(listingTitle)
  const query = normalizeName(target)
  if (!listing || !query) return false
  if (listing === query) return true
  if (listing.includes(query) || query.includes(listing)) return true
  return tokenOverlap(listing, query) >= 0.7
}

export function scoreListing(listing: Pick<BusinessListing, "title" | "address" | "city" | "state">, query: SearchQuery): number {
  let score = 0
  const title = normalizeName(listing.title)
  const name = normalizeName(query.name)
  if (title && name) {
    if (title === name) score += 100
    else if (title.includes(name) || name.includes(title)) score += 80
    else score += Math.round(tokenOverlap(title, name) * 70)
  }

  const haystack = normalizeName([listing.address, listing.city, listing.state].filter(Boolean).join(" "))
  const city = normalizeName(query.city)
  if (city && haystack.includes(city)) score += 15

  const abbr = toStateAbbr(query.state).toLowerCase()
  const stateName = normalizeName(toStateName(query.state))
  if (abbr && (haystack.includes(abbr) || haystack.includes(stateName))) score += 10

  return score
}

export function rankListings(listings: BusinessListing[], query: SearchQuery): BusinessListing[] {
  const scored = listings.map((listing) => ({
    ...listing,
    matchScore: scoreListing(listing, query),
    isBestMatch: false,
  }))
  scored.sort((a, b) => b.matchScore - a.matchScore || (b.reviewCount ?? 0) - (a.reviewCount ?? 0))
  if (scored[0] && scored[0].matchScore >= 50) {
    const second = scored[1]?.matchScore ?? 0
    if (scored[0].matchScore - second >= 4 || scored.length === 1) {
      scored[0].isBestMatch = true
    }
  }
  return scored
}

export function mapsSearchUrl(query: SearchQuery): string {
  const q = [query.name, query.city, toStateName(query.state)].filter(Boolean).join(" ")
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

export function mapsPlaceUrl(listing: Pick<BusinessListing, "title" | "address" | "lat" | "lng" | "placeId" | "cid">): string {
  if (listing.cid) return `https://www.google.com/maps?cid=${encodeURIComponent(String(listing.cid))}`
  if (listing.placeId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.title)}&query_place_id=${encodeURIComponent(listing.placeId)}`
  }
  const label = [listing.title, listing.address].filter(Boolean).join(" ")
  if (listing.lat != null && listing.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${listing.lat},${listing.lng}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label)}`
}
