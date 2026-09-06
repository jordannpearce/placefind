import type {
  BusinessListing,
  Campaign,
  CampaignInput,
  CompetitorListing,
  ConfirmedListing,
  SearchQuery,
  SearchResponse,
  TrafficJob,
  TrafficPinResult,
} from "./types.ts"

export function listingIdentity(listing: Pick<BusinessListing, "placeId" | "title" | "address">): string {
  return `${listing.placeId || ""}::${listing.title}::${listing.address}`
}

export function listingsFromSearch(result: SearchResponse | null): BusinessListing[] {
  if (!result) return []
  const rows = [result.best, ...result.others].filter((row): row is BusinessListing => Boolean(row))
  const seen = new Set<string>()
  const unique: BusinessListing[] = []
  for (const row of rows) {
    const key = listingIdentity(row)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(row)
  }
  return unique
}

export function confirmedListingFromSearch(listing: BusinessListing): ConfirmedListing | null {
  const placeId = listing.placeId?.trim() ?? ""
  const title = listing.title.trim()
  if (!placeId || !title || listing.lat == null || listing.lng == null) return null
  if (!Number.isFinite(listing.lat) || !Number.isFinite(listing.lng)) return null
  return {
    title,
    address: listing.address.trim(),
    rating: listing.rating ?? null,
    reviewCount: listing.reviewCount ?? null,
    placeId,
    lat: listing.lat,
    lng: listing.lng,
    city: listing.city,
    state: listing.state,
  }
}

export function confirmedListingFromCampaign(campaign: Campaign): ConfirmedListing | null {
  const placeId = campaign.placeId?.trim() ?? ""
  const title = (campaign.listingTitle || campaign.businessName).trim()
  const center = campaign.center
  if (!placeId || !title || !center) return null
  return {
    title,
    address: (campaign.listingAddress || "").trim(),
    placeId,
    lat: center.lat,
    lng: center.lng,
    city: campaign.city,
    state: campaign.state,
  }
}

export function scanBusinessEnabled(listing: ConfirmedListing | null): boolean {
  return Boolean(listing?.placeId && listing.title && Number.isFinite(listing.lat) && Number.isFinite(listing.lng))
}

export function campaignScanFinished(campaign: Campaign | null | undefined): boolean {
  const grid = campaign?.lastGridScan
  if (grid?.status === "running") return false
  return Boolean(grid || campaign?.lastScan)
}

export function countFinishedScanPins(points: Array<{ status?: string }> | null | undefined): number {
  return (points ?? []).filter((point) => point.status === "rank" || point.status === "not_found" || point.status === "error").length
}

export function scanLiveStatus(done: number, total: number): string {
  if (total <= 0) return "Scanning…"
  if (done >= total) return `Scanned ${total} of ${total} pins`
  return `Scanning pin ${Math.min(total, done + 1)} of ${total}…`
}

export function scanGridPageError(points: Array<{ status?: string; error?: string }> | null | undefined): string | null {
  const rows = points ?? []
  if (rows.length === 0) return null
  if (rows.every((point) => point.status === "error")) {
    return rows[0]?.error || "Maps search could not finish this grid."
  }
  return null
}

export function startTrafficVisible(listing: ConfirmedListing | null): boolean {
  return scanBusinessEnabled(listing)
}

export function startTrafficEnabled(input: {
  listing: ConfirmedListing | null
  campaign: Campaign | null | undefined
  scanning?: boolean
  starting?: boolean
  busy?: boolean
  running?: boolean
}): boolean {
  if (!startTrafficVisible(input.listing)) return false
  if (input.scanning || input.starting || input.busy || input.running) return false
  return campaignScanFinished(input.campaign)
}

export function startTrafficLabel(input: { scanning?: boolean; starting?: boolean; scanFinished?: boolean }): string {
  if (input.scanning) return "Scanning…"
  if (input.starting) return "Starting traffic…"
  if (!input.scanFinished) return "Scan first"
  return "Start Traffic"
}

export function stopTrafficVisible(job?: TrafficJob | null): boolean {
  return job?.status === "running"
}

export function noPinsSelectedMessage() {
  return "Select at least one pin"
}

export function noKeywordsSelectedMessage() {
  return "Add at least one keyword"
}

export function trafficKeywordHelpCopy() {
  return "Traffic will search those keywords on Maps from the selected pin GPS, then open the confirmed listing when it appears. If several keywords are selected, each pin runs them in listed order."
}

export function trafficLogEmptyCopy() {
  return "No traffic yet. Select pins on the map and keywords to search, then start traffic."
}

export function trafficLogLoadingCopy() {
  return "Starting traffic from the selected pins and keywords…"
}

export function listedTrafficKeywords(campaign: Pick<Campaign, "keywords" | "lastGridScan" | "businessName"> | null | undefined): string[] {
  if (!campaign) return []
  if (campaign.keywords.length > 0) return campaign.keywords
  const fallback = campaign.lastGridScan?.keywords?.length
    ? campaign.lastGridScan.keywords
    : (campaign.lastGridScan?.keyword || campaign.businessName || "").trim()
  return typeof fallback === "string" ? (fallback ? [fallback] : []) : fallback
}

export function selectedKeywordsInListedOrder(listed: string[], selected: string[]): string[] {
  const picked = new Set(selected.map((keyword) => keyword.toLowerCase()))
  return listed.filter((keyword) => picked.has(keyword.toLowerCase()))
}

export function trafficPinStatusLabel(status: TrafficPinResult["status"] | TrafficJob["status"]): string {
  if (status === "ok") return "Opened"
  if (status === "fail" || status === "error") return "Failed"
  if (status === "cancelled" || status === "stopped") return "Stopped"
  if (status === "running") return "Running"
  if (status === "pending") return "Waiting"
  return status
}

export function searchQueryFromCampaign(campaign: Pick<Campaign, "businessName" | "city" | "state">): SearchQuery {
  return {
    name: campaign.businessName,
    city: campaign.city,
    state: campaign.state,
  }
}

export function campaignInputFromListing(
  listing: ConfirmedListing,
  query: SearchQuery,
  extra: Partial<CampaignInput> = {},
): CampaignInput {
  return {
    name: listing.title,
    businessName: listing.title,
    listingTitle: listing.title,
    listingAddress: listing.address,
    city: listing.city || query.city,
    state: listing.state || query.state,
    placeId: listing.placeId,
    center: { lat: listing.lat, lng: listing.lng },
    ...extra,
  }
}

export function searchChanged(previous: SearchQuery, next: SearchQuery): boolean {
  return previous.name !== next.name || previous.city !== next.city || previous.state !== next.state
}

export function competitorHasGeo(
  row: Pick<CompetitorListing, "geoCities" | "usesStateName" | "usesStateAbbr">,
): boolean {
  return row.geoCities.length > 0 || row.usesStateName || row.usesStateAbbr
}

export function filterCompetitors(rows: CompetitorListing[] | null | undefined, geoOnly: boolean): CompetitorListing[] {
  const list = rows ?? []
  return geoOnly ? list.filter(competitorHasGeo) : list
}

export function rollupCompetitors(points: Array<{ competitors?: CompetitorListing[] }>): CompetitorListing[] {
  const byKey = new Map<string, CompetitorListing>()
  for (const point of points) {
    for (const row of point.competitors ?? []) {
      const key = (row.placeId || "").trim() || row.title.trim().toLowerCase()
      if (!key) continue
      const prev = byKey.get(key)
      if (!prev || row.rank < prev.rank) byKey.set(key, row)
    }
  }
  return [...byKey.values()].sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title))
}

export function competitorsGeoFilterLabel() {
  return "Has geo in name"
}
