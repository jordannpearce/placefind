export type ListingReview = {
  id: string
  listingId: string
  authorName: string
  rating: number
  text: string
  createdAt: string
}

export type ReviewSummary = {
  count: number
  average: number | null
}

export function reviewSummary(reviews: Array<Pick<ListingReview, "rating">>): ReviewSummary {
  if (reviews.length === 0) return { count: 0, average: null }
  const total = reviews.reduce((sum, row) => sum + row.rating, 0)
  return { count: reviews.length, average: Math.round((total / reviews.length) * 10) / 10 }
}

export function validateReview(input: { authorName?: string; rating?: number; text?: string }): {
  value?: { authorName: string; rating: number; text: string }
  error?: string
} {
  const authorName = input.authorName?.trim() ?? ""
  const text = input.text?.trim() ?? ""
  const rating = Number(input.rating)
  if (input.authorName !== undefined && authorName.length < 2) return { error: "Enter your name." }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Choose a rating from 1 to 5." }
  if (text.length < 8) return { error: "Write a short review." }
  if (text.length > 1200) return { error: "Keep the review under 1,200 characters." }
  return { value: { authorName: authorName.slice(0, 80), rating, text } }
}
