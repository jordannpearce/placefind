import { scoreListing } from "./match.ts"
import type { BusinessListing, SearchQuery } from "./types.ts"

export const RANK_MATCH_THRESHOLD = 50

export type RankHit<T> = {
  rank: number | null
  index: number
  listing: T | null
  matchScore: number
}

export function rankOfBusiness<T extends Pick<BusinessListing, "title" | "address" | "city" | "state">>(
  listings: T[],
  businessName: string,
  city: string,
  state: string,
): RankHit<T> {
  const query: SearchQuery = { name: businessName, city, state }
  let bestIndex = -1
  let bestScore = 0

  listings.forEach((listing, index) => {
    const score = scoreListing(listing, query)
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  })

  if (bestIndex < 0 || bestScore < RANK_MATCH_THRESHOLD) {
    return { rank: null, index: -1, listing: null, matchScore: bestScore }
  }

  return {
    rank: bestIndex + 1,
    index: bestIndex,
    listing: listings[bestIndex] ?? null,
    matchScore: bestScore,
  }
}
