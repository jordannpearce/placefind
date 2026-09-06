import { titlesMatchExactly } from "./match.ts"
import type { BusinessListing } from "./types.ts"

export const RANK_MATCH_THRESHOLD = 50
export const MAX_COMPETITORS_PER_PIN = 20
export const ORGANIC_RANK_FIELD = "rank_group"
export const ORGANIC_RANK_FALLBACK_FIELD = "organic_index"

export type OrganicRankField = typeof ORGANIC_RANK_FIELD | typeof ORGANIC_RANK_FALLBACK_FIELD

export type RankHit<T> = {
  rank: number | null
  index: number
  listing: T | null
  matchScore: number
  rankField?: OrganicRankField | null
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
  cid?: string | number | null
  rating?: { value?: number | null; votes_count?: number | null } | null
  address_info?: { address?: string | null; city?: string | null; region?: string | null } | null
}

export type MapsRankTarget = {
  name: string
  placeId?: string | null
  cid?: string | number | null
  city?: string
  state?: string
}

export type CompetitorRow = {
  title: string
  rank: number
  rating: number | null
  address: string | null
  placeId: string | null
}

let loggedOrganicRankField = false

function logOrganicRankField(field: OrganicRankField) {
  if (loggedOrganicRankField) return
  loggedOrganicRankField = true
  console.info(
    `PlaceFind organic rank uses ${field} among maps_search items. Paid listings are ignored. rank_absolute is not used because it includes ads.`,
  )
}

export function resetRankFieldLogForTests() {
  loggedOrganicRankField = false
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

function cidsMatch(left?: string | number | null, right?: string | number | null): boolean {
  const a = left == null ? "" : String(left).trim()
  const b = right == null ? "" : String(right).trim()
  return Boolean(a && b && a === b)
}

function itemTitle(item: Pick<MapsSerpItem, "title" | "original_title">): string {
  return (item.title || item.original_title || "").trim()
}

function organicRank(item: MapsSerpItem, index: number): { rank: number; field: OrganicRankField } {
  if (item.rank_group && item.rank_group > 0) {
    logOrganicRankField(ORGANIC_RANK_FIELD)
    return { rank: item.rank_group, field: ORGANIC_RANK_FIELD }
  }
  logOrganicRankField(ORGANIC_RANK_FALLBACK_FIELD)
  return { rank: index + 1, field: ORGANIC_RANK_FALLBACK_FIELD }
}

function confirmedHit<T extends MapsSerpItem>(organic: T[], index: number, matchScore: number): RankHit<T> {
  const listing = organic[index]!
  const { rank, field } = organicRank(listing, index)
  return { rank, index, listing, matchScore, rankField: field }
}

function missedHit<T>(): RankHit<T> {
  return { rank: null, index: -1, listing: null, matchScore: 0, rankField: null }
}

function isTargetItem(item: MapsSerpItem, target: MapsRankTarget): boolean {
  const placeId = target.placeId?.trim() || null
  const cid = target.cid == null ? "" : String(target.cid).trim()
  if (placeId && placeIdsMatch(item.place_id, placeId)) return true
  if (cid && cidsMatch(item.cid, cid)) return true
  return false
}

export function rankOfBusiness<T extends Pick<BusinessListing, "title" | "address" | "city" | "state" | "placeId">>(
  listings: T[],
  businessName: string,
  _city: string,
  _state: string,
  placeId?: string | null,
): RankHit<T> {
  if (placeId?.trim()) {
    const index = listings.findIndex((listing) => placeIdsMatch(listing.placeId, placeId))
    if (index < 0) return missedHit()
    return { rank: index + 1, index, listing: listings[index] ?? null, matchScore: 100, rankField: ORGANIC_RANK_FALLBACK_FIELD }
  }

  const index = listings.findIndex((listing) => titlesMatchExactly(listing.title, businessName))
  if (index < 0) return missedHit()
  return { rank: index + 1, index, listing: listings[index] ?? null, matchScore: 100, rankField: ORGANIC_RANK_FALLBACK_FIELD }
}

/** 1-based organic Maps position for the campaign business, or not found. Paid items are ignored. */
export function rankFromMapsItems(items: MapsSerpItem[] | null | undefined, target: MapsRankTarget): RankHit<MapsSerpItem> {
  const organic = organicMapsItems(items)
  const placeId = target.placeId?.trim() || null
  const cid = target.cid == null ? "" : String(target.cid).trim()
  const exactName = target.name.trim()

  if (placeId) {
    const index = organic.findIndex((item) => placeIdsMatch(item.place_id, placeId))
    if (index >= 0) return confirmedHit(organic, index, 100)
    if (cid) {
      const cidIndex = organic.findIndex((item) => cidsMatch(item.cid, cid))
      if (cidIndex >= 0) return confirmedHit(organic, cidIndex, 100)
    }
    return missedHit()
  }

  if (cid) {
    const index = organic.findIndex((item) => cidsMatch(item.cid, cid))
    if (index >= 0) return confirmedHit(organic, index, 100)
    return missedHit()
  }

  if (exactName) {
    const index = organic.findIndex((item) => {
      const title = itemTitle(item)
      return titlesMatchExactly(title, exactName) || titlesMatchExactly(item.original_title || "", exactName)
    })
    if (index >= 0) return confirmedHit(organic, index, 95)
  }

  return missedHit()
}

export function competitorsFromMapsItems(
  items: MapsSerpItem[] | null | undefined,
  target: MapsRankTarget,
  cap = MAX_COMPETITORS_PER_PIN,
): CompetitorRow[] {
  const organic = organicMapsItems(items)
  const limit = Math.max(0, Math.floor(Number(cap) || 0))
  const rows: CompetitorRow[] = []
  organic.forEach((item, index) => {
    if (isTargetItem(item, target)) return
    const title = itemTitle(item)
    if (!title) return
    const { rank } = organicRank(item, index)
    rows.push({
      title,
      rank,
      rating: item.rating?.value ?? null,
      address: item.address || item.address_info?.address || null,
      placeId: item.place_id ?? null,
    })
  })
  return rows.slice(0, limit)
}
