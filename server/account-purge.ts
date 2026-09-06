import { deleteManagedUser, isReservedSampleEmail, publicUser, readUsers, type PublicUser } from "./auth.ts"
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

export function purgeLeftoverSampleUsers(): PublicUser[] {
  const removed: PublicUser[] = []
  for (const user of readUsers()) {
    if (!isReservedSampleEmail(user.email)) continue
    const result = deleteManagedUser(user.id)
    if (!result.ok) continue
    purgeAccountOwnedData(user.id)
    removed.push(publicUser(user))
  }
  return removed
}
