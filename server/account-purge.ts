import { deleteManagedUser } from "./auth.ts"
import { deleteCampaignsForUser } from "./campaigns.ts"
import { deleteListingsOwnedBy } from "./listings.ts"
import { deleteReviewsForListings } from "./reviews.ts"
import { deleteCrawlsForUser } from "./site-crawl.ts"
import { deleteUsageForUser } from "./usage.ts"

export function purgeAccountOwnedData(userId: string) {
  const listingIds = deleteListingsOwnedBy(userId)
  deleteReviewsForListings(listingIds)
  deleteCrawlsForUser(userId, listingIds)
  deleteUsageForUser(userId)
  deleteCampaignsForUser(userId)
}

export function deleteManagedAccount(id: string, actorId?: string) {
  const result = deleteManagedUser(id, actorId)
  if (result.ok) purgeAccountOwnedData(id)
  return result
}
