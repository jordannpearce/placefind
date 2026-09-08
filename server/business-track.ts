import {
  businessCampaignCreateDenied,
  businessCampaignUpdateDenied,
  businessTrafficDenied,
  campaignMatchesOwnedListing,
  isCappedBusinessAccount,
  stampOwnedListingOnCampaign,
  type BusinessTrackDenial,
} from "../src/lib/business-track.ts"
import type { AuthUser, CampaignInput } from "../src/lib/types.ts"
import { CampaignError, getCampaign, readCampaigns, type Campaign } from "./campaigns.ts"
import { listingsForUser } from "./listings.ts"

function throwDenied(denied: BusinessTrackDenial | null) {
  if (!denied) return
  throw new CampaignError(denied.error, denied.status)
}

export function ownedListingForUser(userId: string) {
  return listingsForUser(userId)[0] ?? null
}

export function businessCampaignsForUser(userId: string): Campaign[] {
  const listing = ownedListingForUser(userId)
  const rows = readCampaigns(userId)
  if (!listing) return []
  return rows.filter((row) => campaignMatchesOwnedListing(row, listing))
}

export function assertBusinessCampaignCreate(
  user: Pick<AuthUser, "id" | "role" | "accountKind">,
  input: CampaignInput,
) {
  const listing = ownedListingForUser(user.id)
  throwDenied(
    businessCampaignCreateDenied({
      user,
      ownedListing: listing,
      existingCampaignCount: listing ? businessCampaignsForUser(user.id).length : 0,
      body: input,
    }),
  )
}

export function assertBusinessCampaignUpdate(
  user: Pick<AuthUser, "id" | "role" | "accountKind">,
  campaign: Pick<Campaign, "listingId" | "businessName" | "city" | "state" | "placeId" | "name">,
  input: CampaignInput,
) {
  throwDenied(
    businessCampaignUpdateDenied({
      user,
      ownedListing: ownedListingForUser(user.id),
      campaign,
      body: input,
    }),
  )
}

export function assertBusinessTraffic(
  user: Pick<AuthUser, "id" | "role" | "accountKind">,
  campaign: Pick<Campaign, "listingId" | "businessName" | "city" | "state" | "placeId" | "name"> | null,
) {
  throwDenied(
    businessTrafficDenied({
      user,
      ownedListing: ownedListingForUser(user.id),
      campaign,
    }),
  )
}

export function assertBusinessCampaignAccess(
  user: Pick<AuthUser, "id" | "role" | "accountKind">,
  campaign: Pick<Campaign, "listingId" | "businessName" | "city" | "state" | "placeId" | "name"> | null,
) {
  throwDenied(
    businessCampaignUpdateDenied({
      user,
      ownedListing: ownedListingForUser(user.id),
      campaign,
      body: null,
    }),
  )
}

export function withOwnedListingCampaignInput(
  user: Pick<AuthUser, "id" | "role" | "accountKind">,
  input: CampaignInput,
): CampaignInput {
  if (!isCappedBusinessAccount(user)) return input
  const listing = ownedListingForUser(user.id)
  if (!listing) return input
  return stampOwnedListingOnCampaign(input, listing)
}

export function campaignForBusinessUser(id: string, user: Pick<AuthUser, "id" | "role" | "accountKind">): Campaign | null {
  const campaign = getCampaign(id, user.id)
  if (!campaign) return null
  if (isCappedBusinessAccount(user)) {
    const denied = businessTrafficDenied({
      user,
      ownedListing: ownedListingForUser(user.id),
      campaign,
    })
    if (denied) return null
  }
  return campaign
}
