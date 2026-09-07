import type express from "express"
import { ACCOUNT_PENDING_REVIEW_MESSAGE, canLeaveReview } from "../src/lib/account.ts"
import type { QuoteLeadInput } from "../src/lib/quotes.ts"
import { ListingError } from "./listings.ts"
import { createReview, listingReviewSummary, reviewsForListing } from "./reviews.ts"
import { submitQuoteLead } from "./quotes.ts"

export type LeadUser = { id: string; name: string; role?: string; status?: string; accountKind?: string }

export function registerListingLeadRoutes(
  app: express.Express,
  requireUser: (req: express.Request, res: express.Response) => LeadUser | null,
) {
  app.post("/api/listings/:id/reviews", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
    if (!canLeaveReview(user)) {
      res.status(403).json({ error: ACCOUNT_PENDING_REVIEW_MESSAGE })
      return
    }
    try {
      const review = createReview(String(req.params.id ?? ""), req.body ?? {}, user)
      res.status(201).json({
        review,
        reviews: reviewsForListing(review.listingId),
        reviewSummary: listingReviewSummary(review.listingId),
      })
    } catch (error) {
      if (error instanceof ListingError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not save that review." })
    }
  })

  app.post("/api/listings/:id/quotes", async (req, res) => {
    try {
      const body = (req.body ?? {}) as QuoteLeadInput
      await submitQuoteLead(String(req.params.id ?? ""), body)
      res.status(201).json({ ok: true })
    } catch (error) {
      if (error instanceof ListingError) {
        res.status(error.status).json({ error: error.message })
        return
      }
      res.status(500).json({ error: "Could not send that quote request." })
    }
  })
}
