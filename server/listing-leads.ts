import type express from "express"
import { ListingError } from "./listings.ts"
import { createReview, listingReviewSummary, reviewsForListing } from "./reviews.ts"
import { submitQuoteLead } from "./quotes.ts"

export type LeadUser = { id: string; name: string }

export function registerListingLeadRoutes(
  app: express.Express,
  requireUser: (req: express.Request, res: express.Response) => LeadUser | null,
) {
  app.post("/api/listings/:id/reviews", (req, res) => {
    const user = requireUser(req, res)
    if (!user) return
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
    const user = requireUser(req, res)
    if (!user) return
    try {
      const body = (req.body ?? {}) as { name?: string; email?: string; phone?: string; need?: string }
      await submitQuoteLead(String(req.params.id ?? ""), {
        name: body.name || user.name,
        email: body.email,
        phone: body.phone,
        need: body.need,
      })
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
