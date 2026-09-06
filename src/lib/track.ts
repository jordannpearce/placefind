import type {
  BusinessListing,
  Campaign,
  CampaignInput,
  ConfirmedListing,
  SearchQuery,
  SearchResponse,
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
