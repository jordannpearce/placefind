import type { CompetitorStat, PointResult, ScanStats } from "./types"
import { normalizeName } from "./rank"

const NOT_FOUND_RANK = 21

export function computeStats(results: PointResult[], targetBusiness: string): ScanStats {
  const completed = results.length
  const errors = results.filter((r) => r.error).length
  const found = results.filter((r) => r.found).length
  const notFound = results.filter((r) => !r.error && !r.found).length
  const ranks = results.filter((r) => r.found && r.rank != null).map((r) => r.rank as number)
  const averageRank =
    ranks.length > 0 ? Number((ranks.reduce((a, b) => a + b, 0) / ranks.length).toFixed(1)) : null

  const atrValues = results
    .filter((r) => !r.error)
    .map((r) => (r.rank != null ? r.rank : NOT_FOUND_RANK))
  const atr =
    atrValues.length > 0
      ? Number((atrValues.reduce((a, b) => a + b, 0) / atrValues.length).toFixed(1))
      : null

  const top3 = results.filter((r) => r.rank != null && r.rank <= 3).length
  const scored = results.filter((r) => !r.error).length

  return {
    points: completed,
    completed,
    found,
    notFound,
    errors,
    averageRank,
    atr,
    top3Share: scored ? Number(((top3 / scored) * 100).toFixed(0)) : 0,
    coverage: scored ? Number(((found / scored) * 100).toFixed(0)) : 0,
    competitors: aggregateCompetitors(results, targetBusiness),
  }
}

function aggregateCompetitors(results: PointResult[], targetBusiness: string): CompetitorStat[] {
  const target = normalizeName(targetBusiness)
  const byKey = new Map<
    string,
    {
      title: string
      placeId: string | null
      ranks: number[]
      rating: number | null
      reviews: number | null
    }
  >()

  for (const result of results) {
    for (const listing of result.listings) {
      if (listing.isPaid) continue
      const key = listing.placeId || normalizeName(listing.title)
      if (!key) continue
      if (target && normalizeName(listing.title) === target) continue

      const existing = byKey.get(key)
      if (existing) {
        existing.ranks.push(listing.rankAbsolute)
        if ((listing.reviews ?? 0) > (existing.reviews ?? 0)) {
          existing.rating = listing.rating
          existing.reviews = listing.reviews
          existing.title = listing.title
        }
      } else {
        byKey.set(key, {
          title: listing.title,
          placeId: listing.placeId,
          ranks: [listing.rankAbsolute],
          rating: listing.rating,
          reviews: listing.reviews,
        })
      }
    }
  }

  return [...byKey.values()]
    .map((entry) => {
      const averageRank = entry.ranks.reduce((a, b) => a + b, 0) / entry.ranks.length
      const top3 = entry.ranks.filter((rank) => rank <= 3).length
      return {
        title: entry.title,
        placeId: entry.placeId,
        appearances: entry.ranks.length,
        averageRank: Number(averageRank.toFixed(1)),
        top3Share: Number(((top3 / Math.max(results.length, 1)) * 100).toFixed(0)),
        rating: entry.rating,
        reviews: entry.reviews,
      }
    })
    .sort((a, b) => b.appearances - a.appearances || a.averageRank - b.averageRank)
    .slice(0, 8)
}
