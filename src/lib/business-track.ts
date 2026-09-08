import { accountKindOf } from "./account.ts"
import { toStateAbbr } from "./states.ts"
import type { AuthUser, Campaign, CampaignInput, DirectoryListing } from "./types.ts"

export const BUSINESS_NEED_LISTING_MESSAGE =
  "Create your PlaceFind listing first. Rank tracker and Traffic only work for that one shop."

export const BUSINESS_ONE_TRACK_MESSAGE =
  "This account can track rankings for one business — the listing on this account."

export const BUSINESS_OTHER_LISTING_MESSAGE =
  "Rank tracker and Traffic can only target the listing on this account."

export const BUSINESS_ONE_TRAFFIC_MESSAGE =
  "Traffic stays on that same listing. This account cannot run traffic for another shop."

export const BUSINESS_TRACK_SCAN_COPY =
  "Business track scan: we scan ranks for your listing only. Extra shops and competitor-as-primary grids stay on admin tools."

export const BUSINESS_TRACK_LOCKED_COPY =
  "Name, city, and state come from your listing. Confirm that Maps match, then scan."

export const BUSINESS_NO_LISTING_TRACK_COPY =
  "This account tracks one shop. Create your listing first, then come back to run a business track scan."

export const BUSINESS_MAPS_OTHER_LISTING_MESSAGE =
  "Choose the Maps listing that matches your PlaceFind shop. This account cannot track a competitor as the primary business."

export type TrackTarget = {
  id?: string
  name?: string
  businessName?: string
  city?: string
  state?: string
  placeId?: string | null
  listingId?: string | null
}

export type BusinessTrackDenial = {
  status: 400 | 403
  error: string
}

export function isCappedBusinessAccount(
  user: Pick<AuthUser, "role" | "accountKind"> | null | undefined,
): boolean {
  if (!user) return false
  if (user.role === "admin") return false
  return accountKindOf(user) === "business"
}

export function normalizeTrackName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function sameTrackCity(left: string, right: string): boolean {
  return normalizeTrackName(left) === normalizeTrackName(right)
}

export function sameTrackState(left: string, right: string): boolean {
  const a = toStateAbbr(left)
  const b = toStateAbbr(right)
  return Boolean(a && b && a === b)
}

export function sameTrackName(left: string, right: string): boolean {
  const a = normalizeTrackName(left)
  const b = normalizeTrackName(right)
  if (!a || !b) return false
  if (a === b) return true
  return a.includes(b) || b.includes(a)
}

export function ownedListingForTrack(
  listings: DirectoryListing[] | null | undefined,
  listingId?: string | null,
): DirectoryListing | null {
  const rows = listings ?? []
  if (listingId?.trim()) {
    return rows.find((row) => row.id === listingId.trim()) ?? rows[0] ?? null
  }
  return rows[0] ?? null
}

export function campaignListingId(target: TrackTarget | null | undefined): string {
  return (target?.listingId || target?.id || "").trim()
}

export function campaignMatchesOwnedListing(
  target: TrackTarget | null | undefined,
  listing: Pick<DirectoryListing, "id" | "name" | "city" | "state" | "placeId"> | null | undefined,
): boolean {
  if (!target || !listing) return false
  const listingId = campaignListingId(target)
  if (listingId) return listingId === listing.id
  const name = target.businessName || target.name || ""
  if (name && !sameTrackName(name, listing.name)) return false
  if (target.city && !sameTrackCity(target.city, listing.city)) return false
  if (target.state && !sameTrackState(target.state, listing.state)) return false
  const placeId = target.placeId?.trim() ?? ""
  const ownedPlace = listing.placeId?.trim() ?? ""
  if (placeId && ownedPlace && placeId !== ownedPlace) return false
  return Boolean(name || target.city || target.state || placeId)
}

export function inputSpecifiesTrackTarget(input: Partial<CampaignInput> | null | undefined): boolean {
  if (!input) return false
  return Boolean(
    input.listingId?.trim() ||
      input.businessName?.trim() ||
      input.city?.trim() ||
      input.state?.trim() ||
      input.placeId?.trim(),
  )
}

export function inputMatchesOwnedListing(
  input: Partial<CampaignInput> | null | undefined,
  listing: Pick<DirectoryListing, "id" | "name" | "city" | "state" | "placeId">,
): boolean {
  if (!input || !inputSpecifiesTrackTarget(input)) return true
  if (input.listingId?.trim() && input.listingId.trim() !== listing.id) return false
  if (input.businessName?.trim() && !sameTrackName(input.businessName, listing.name)) return false
  if (input.city?.trim() && !sameTrackCity(input.city, listing.city)) return false
  if (input.state?.trim() && !sameTrackState(input.state, listing.state)) return false
  const placeId = input.placeId?.trim() ?? ""
  const ownedPlace = listing.placeId?.trim() ?? ""
  if (placeId && ownedPlace && placeId !== ownedPlace) return false
  return true
}

export function mapsPlaceAllowedForOwnedListing(
  listing: Pick<DirectoryListing, "name" | "city" | "state" | "placeId">,
  place: { title?: string; placeId?: string | null; city?: string; state?: string },
): boolean {
  const ownedPlace = listing.placeId?.trim() ?? ""
  const placeId = place.placeId?.trim() ?? ""
  if (ownedPlace && placeId) return ownedPlace === placeId
  if (!sameTrackName(listing.name, place.title ?? "")) return false
  if (place.city && !sameTrackCity(place.city, listing.city)) return false
  if (place.state && !sameTrackState(place.state, listing.state)) return false
  return true
}

export function businessCampaignCreateDenied(input: {
  user: Pick<AuthUser, "role" | "accountKind"> | null | undefined
  ownedListing: Pick<DirectoryListing, "id" | "name" | "city" | "state" | "placeId"> | null
  existingCampaignCount: number
  body?: Partial<CampaignInput> | null
}): BusinessTrackDenial | null {
  if (!isCappedBusinessAccount(input.user)) return null
  if (!input.ownedListing) return { status: 400, error: BUSINESS_NEED_LISTING_MESSAGE }
  if (input.existingCampaignCount >= 1) return { status: 403, error: BUSINESS_ONE_TRACK_MESSAGE }
  if (!inputMatchesOwnedListing(input.body, input.ownedListing)) {
    return { status: 403, error: BUSINESS_OTHER_LISTING_MESSAGE }
  }
  return null
}

export function businessCampaignUpdateDenied(input: {
  user: Pick<AuthUser, "role" | "accountKind"> | null | undefined
  ownedListing: Pick<DirectoryListing, "id" | "name" | "city" | "state" | "placeId"> | null
  campaign?: TrackTarget | null
  body?: Partial<CampaignInput> | null
}): BusinessTrackDenial | null {
  if (!isCappedBusinessAccount(input.user)) return null
  if (!input.ownedListing) return { status: 400, error: BUSINESS_NEED_LISTING_MESSAGE }
  if (input.campaign && !campaignMatchesOwnedListing(input.campaign, input.ownedListing)) {
    if (inputSpecifiesTrackTarget(input.body) && inputMatchesOwnedListing(input.body, input.ownedListing)) {
      return null
    }
    return { status: 403, error: BUSINESS_OTHER_LISTING_MESSAGE }
  }
  if (!inputMatchesOwnedListing(input.body, input.ownedListing)) {
    return { status: 403, error: BUSINESS_OTHER_LISTING_MESSAGE }
  }
  return null
}

export function businessTrafficDenied(input: {
  user: Pick<AuthUser, "role" | "accountKind"> | null | undefined
  ownedListing: Pick<DirectoryListing, "id" | "name" | "city" | "state" | "placeId"> | null
  campaign?: TrackTarget | null
}): BusinessTrackDenial | null {
  if (!isCappedBusinessAccount(input.user)) return null
  if (!input.ownedListing) return { status: 400, error: BUSINESS_NEED_LISTING_MESSAGE }
  if (!campaignMatchesOwnedListing(input.campaign, input.ownedListing)) {
    return { status: 403, error: BUSINESS_ONE_TRAFFIC_MESSAGE }
  }
  return null
}

export function stampOwnedListingOnCampaign(
  input: CampaignInput,
  listing: Pick<DirectoryListing, "id" | "name" | "city" | "state">,
): CampaignInput {
  return {
    ...input,
    listingId: listing.id,
    businessName: input.businessName?.trim() || listing.name,
    city: input.city?.trim() || listing.city,
    state: input.state?.trim() || listing.state,
    name: input.name?.trim() || listing.name,
  }
}

export function showBusinessNewCampaign(user: Pick<AuthUser, "role" | "accountKind"> | null | undefined): boolean {
  return !isCappedBusinessAccount(user)
}

export function showSearchOtherBusiness(user: Pick<AuthUser, "role" | "accountKind"> | null | undefined): boolean {
  return !isCappedBusinessAccount(user)
}

export function businessTrackListings(
  user: Pick<AuthUser, "role" | "accountKind"> | null | undefined,
  listings: DirectoryListing[],
): DirectoryListing[] {
  if (!isCappedBusinessAccount(user)) return listings
  const owned = ownedListingForTrack(listings)
  return owned ? [owned] : []
}

export function matchingBusinessCampaign(
  campaigns: Campaign[],
  listing: Pick<DirectoryListing, "id" | "name" | "city" | "state" | "placeId"> | null,
): Campaign | null {
  if (!listing) return null
  return campaigns.find((campaign) => campaignMatchesOwnedListing(campaign, listing)) ?? null
}
