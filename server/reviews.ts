import { randomBytes } from "node:crypto"
import { reviewSummary, validateReview, type ListingReview } from "../src/lib/reviews.ts"
import { getListing, ListingError } from "./listings.ts"
import { readCollection, writeCollection } from "./store.ts"

const SEED_REVIEWS: Omit<ListingReview, "id">[] = [
  {
    listingId: "seed-1",
    authorName: "Maya Chen",
    rating: 5,
    text: "The sourdough is still warm at 8 a.m. Harbor & Oak is the first stop before the office.",
    createdAt: "2026-07-02T11:20:00.000Z",
  },
  {
    listingId: "seed-1",
    authorName: "Owen Blake",
    rating: 4,
    text: "Busy Saturday line, but the kouign-amann is worth it. Staff called my name when the tray came out.",
    createdAt: "2026-07-18T15:04:00.000Z",
  },
  {
    listingId: "seed-2",
    authorName: "Priya Shah",
    rating: 5,
    text: "Gentle with kids and clear about the treatment plan. Red Mesa felt like a neighborhood office, not a mill.",
    createdAt: "2026-06-11T18:40:00.000Z",
  },
  {
    listingId: "seed-4",
    authorName: "Luis Ortega",
    rating: 5,
    text: "Grouper sandwich and a dozen oysters. Citrus & Salt is the place I send visiting family.",
    createdAt: "2026-08-01T22:10:00.000Z",
  },
  {
    listingId: "seed-6",
    authorName: "Helen Park",
    rating: 4,
    text: "Cut a spare house key and mixed a quart of paint in ten minutes. Old-school hardware, still stocked.",
    createdAt: "2026-05-22T16:33:00.000Z",
  },
]

function newId() {
  return randomBytes(8).toString("hex")
}

function asReview(row: Partial<ListingReview> | null | undefined): ListingReview | null {
  if (!row?.id || !row.listingId || !row.text) return null
  const rating = Number(row.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return null
  return {
    id: String(row.id),
    listingId: String(row.listingId),
    authorName: String(row.authorName ?? "Visitor"),
    rating,
    text: String(row.text),
    createdAt: String(row.createdAt ?? new Date().toISOString()),
  }
}

function readReviews(): ListingReview[] {
  return readCollection<ListingReview>("reviews").flatMap((row) => {
    const review = asReview(row)
    return review ? [review] : []
  })
}

function writeReviews(rows: ListingReview[]) {
  writeCollection("reviews", rows)
}

export function seedDirectoryReviews(force = false): ListingReview[] {
  const existing = readReviews()
  if (existing.length > 0 && !force) return existing
  const seeded = SEED_REVIEWS.map((row, index) => ({ ...row, id: `seed-review-${index + 1}` }))
  writeReviews(force ? [...existing.filter((row) => !row.id.startsWith("seed-review-")), ...seeded] : seeded)
  return readReviews()
}

export function deleteReviewsForListings(listingIds: string[]) {
  if (listingIds.length === 0) return
  const ids = new Set(listingIds)
  writeReviews(readReviews().filter((row) => !ids.has(row.listingId)))
}

export function reviewsForListing(listingId: string): ListingReview[] {
  seedDirectoryReviews()
  let id = listingId
  try {
    id = getListing(listingId).id
  } catch {
    // Keep the given id when the listing row is gone.
  }
  return readReviews()
    .filter((row) => row.listingId === id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function listingReviewSummary(listingId: string) {
  return reviewSummary(reviewsForListing(listingId))
}

export function createReview(
  listingId: string,
  input: { authorName?: string; rating?: number; text?: string },
  author?: { id: string; name: string } | null,
): ListingReview {
  if (!author?.id || !author.name?.trim()) {
    throw new ListingError(401, "Sign in to leave a review.")
  }
  const listing = getListing(listingId)
  const parsed = validateReview({ ...input, authorName: author.name })
  if (parsed.error || !parsed.value) throw new ListingError(400, parsed.error || "Could not save the review.")
  const current = reviewsForListing(listing.id)
  if (current.length >= 200) throw new ListingError(400, "This listing already has a full set of reviews.")
  const review: ListingReview = {
    id: newId(),
    listingId: listing.id,
    authorName: parsed.value.authorName,
    rating: parsed.value.rating,
    text: parsed.value.text,
    createdAt: new Date().toISOString(),
  }
  writeReviews([review, ...readReviews()])
  return review
}

export function publicReview(review: ListingReview) {
  return review
}
