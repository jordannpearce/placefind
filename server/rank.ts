import { namesMatch, scoreListing } from "./match.ts"
import type { BusinessListing, SearchQuery } from "./types.ts"

export const RANK_MATCH_THRESHOLD = 50

export type RankHit<T> = {
  rank: number | null
  index: number
  listing: T | null
  matchScore: number
}

export type MapsSerpItem = {
  type?: string | null
  rank_group?: number | null
  rank_absolute?: number | null
  title?: string | null
  original_title?: string | null
  address?: string | null
  domain?: string | null
  url?: string | null
  place_id?: string | null
  rating?: { value?: number | null; votes_count?: number | null } | null
  address_info?: { address?: string | null; city?: string | null; region?: string | null } | null
}

export type MapsRankTarget = {
  name: string
  placeId?: string | null
  city?: string
  state?: string
}

export function isOrganicMapsItem(item: Pick<MapsSerpItem, "type">): boolean {
  return item.type === "maps_search"
}

export function organicMapsItems<T extends Pick<MapsSerpItem, "type">>(items: T[] | null | undefined): T[] {
  return (items ?? []).filter(isOrganicMapsItem)
}

function placeIdsMatch(left?: string | null, right?: string | null): boolean {
  const a = left?.trim()
  const b = right?.trim()
  return Boolean(a && b && a === b)
}

export function rankOfBusiness<T extends Pick<BusinessListing, "title" | "address" | "city" | "state" | "placeId">>(
  listings: T[],
  businessName: string,
  city: string,
  state: string,
  placeId?: string | null,
): RankHit<T> {
  const query: SearchQuery = { name: businessName, city, state }
  let bestIndex = -1
  let bestScore = 0

  listings.forEach((listing, index) => {
    if (placeIdsMatch(listing.placeId, placeId)) {
      bestIndex = index
      bestScore = 1000
      return
    }
    if (bestScore >= 1000) return
    const score = scoreListing(listing, query)
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  })

  if (bestIndex < 0 || (bestScore < RANK_MATCH_THRESHOLD && bestScore < 1000)) {
    return { rank: null, index: -1, listing: null, matchScore: bestScore >= 1000 ? 100 : bestScore }
  }

  return {
    rank: bestIndex + 1,
    index: bestIndex,
    listing: listings[bestIndex] ?? null,
    matchScore: bestScore >= 1000 ? 100 : bestScore,
  }
}

/** 1-based organic Maps position for the campaign business, or not found. Paid items are ignored. */
export function rankFromMapsItems(items: MapsSerpItem[] | null | undefined, target: MapsRankTarget): RankHit<MapsSerpItem> {
  const organic = organicMapsItems(items)
  const placeId = target.placeId?.trim() || null
  const city = target.city ?? ""
  const state = target.state ?? ""

  if (placeId) {
    const index = organic.findIndex((item) => placeIdsMatch(item.place_id, placeId))
    if (index >= 0) {
      const listing = organic[index]!
      const rank = listing.rank_group && listing.rank_group > 0 ? listing.rank_group : index + 1
      return { rank, index, listing, matchScore: 100 }
    }
  }

  let bestIndex = -1
  let bestScore = 0
  organic.forEach((item, index) => {
    const title = item.title || item.original_title || ""
    if (namesMatch(title, target.name)) {
      const score = scoreListing(
        {
          title,
          address: item.address || item.address_info?.address || "",
          city: item.address_info?.city || city,
          state: item.address_info?.region || state,
        },
        { name: target.name, city, state },
      )
      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    }
  })

  if (bestIndex < 0 || bestScore < RANK_MATCH_THRESHOLD) {
    return { rank: null, index: -1, listing: null, matchScore: bestScore }
  }

  const listing = organic[bestIndex]!
  const rank = listing.rank_group && listing.rank_group > 0 ? listing.rank_group : bestIndex + 1
  return { rank, index: bestIndex, listing, matchScore: bestScore }
}
