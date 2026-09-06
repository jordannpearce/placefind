import { ExternalLink, LoaderCircle, MapPin, Phone, Star } from "lucide-react"
import { useEffect, useState } from "react"
import { createListingReview, loadListing } from "../lib/api.ts"
import { listingLocation, listingPath, listingRedirectPath, mapsStatusDetail } from "../lib/listings.ts"
import { LISTING_PRICE_LABEL } from "../lib/pricing.ts"
import type { AuthUser, DirectoryListing, ListingReview, ReviewSummary } from "../lib/types.ts"

type Props = {
  listingId: string
  user: AuthUser | null
  onGo: (path: string) => void
}

function stars(value: number) {
  return "★".repeat(value) + "☆".repeat(5 - value)
}

export function ListingDetailPage({ listingId, user, onGo }: Props) {
  const [listing, setListing] = useState<DirectoryListing | null>(null)
  const [reviews, setReviews] = useState<ListingReview[]>([])
  const [summary, setSummary] = useState<ReviewSummary>({ count: 0, average: null })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authorName, setAuthorName] = useState(user?.name ?? "")
  const [rating, setRating] = useState(5)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    void loadListing(listingId)
      .then((payload) => {
        setListing(payload.listing)
        setReviews(payload.reviews)
        setSummary(payload.reviewSummary)
        const dest = listingRedirectPath(listingId, payload.listing)
        if (dest && typeof window !== "undefined") {
          window.history.replaceState({}, "", dest)
        }
      })
      .catch((err) => {
        setListing(null)
        setError(err instanceof Error ? err.message : "Could not load that listing.")
      })
      .finally(() => setLoading(false))
  }, [listingId])

  async function submitReview() {
    setSending(true)
    setReviewError(null)
    try {
      const payload = await createListingReview(listingId, { authorName, rating, text })
      setReviews(payload.reviews)
      setSummary(payload.reviewSummary)
      setText("")
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Could not save that review.")
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-line bg-panel px-6 py-12 text-center">
        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-brass" />
        <p className="mt-3 text-sm text-muted">Loading this listing…</p>
      </section>
    )
  }

  if (error || !listing) {
    return (
      <section className="mx-auto w-full max-w-3xl rounded-2xl border border-line bg-panel p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Directory</p>
        <h2 className="mt-2 font-display text-3xl text-paper">Listing not found</h2>
        <p className="mt-3 text-sm leading-6 text-clay">{error || "That PlaceFind profile is not in the directory."}</p>
        <button type="button" onClick={() => onGo("/directory")} className="mt-5 text-sm text-brass hover:underline">
          Back to the directory
        </button>
      </section>
    )
  }

  const canEdit = Boolean(user && (user.role === "admin" || listing.ownerUserId === user.id))
  const enhanced = Boolean(listing.brand || listing.licenseInfo || listing.yearsInBusiness || listing.specialty || listing.profileContent)

  return (
    <article className="mx-auto grid w-full max-w-3xl gap-6">
      <section className="rounded-2xl border border-line bg-panel p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">
          {listing.category || "PlaceFind listing"}
        </p>
        <h2 className="mt-2 font-display text-4xl text-paper">{listing.brand || listing.name}</h2>
        <p className="mt-2 flex items-start gap-2 text-sm text-muted">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          {listingLocation(listing)}
        </p>
        {listing.mapsUrl && (
          <a
            href={listing.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-2 text-sm text-brass hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Open in Maps
          </a>
        )}
        {listing.mapsStatus !== "pending" && (
          <p className="mt-2 text-xs leading-5 text-muted">{mapsStatusDetail(listing)}</p>
        )}
        <p className="mt-3 text-sm text-brass">
          {summary.average != null
            ? `${summary.average.toFixed(1)} from ${summary.count} review${summary.count === 1 ? "" : "s"}`
            : "No reviews yet"}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onGo("/directory")}
            className="h-11 rounded-lg border border-line px-4 text-sm text-paper hover:border-brass"
          >
            Directory
          </button>
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => onGo(`${listingPath(listing)}/edit`)}
                className="h-11 rounded-lg border border-line px-4 text-sm text-paper hover:border-brass"
              >
                Edit listing
              </button>
              <button
                type="button"
                onClick={() => onGo("/dashboard")}
                className="h-11 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a]"
              >
                Crawl Website
              </button>
            </>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Enhanced profile</p>
        {enhanced ? (
          <>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
              {listing.brand && (
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">Brand</dt>
                  <dd className="mt-1 text-paper">{listing.brand}</dd>
                </div>
              )}
              {listing.licenseInfo && (
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">License</dt>
                  <dd className="mt-1 text-paper">{listing.licenseInfo}</dd>
                </div>
              )}
              {listing.yearsInBusiness && (
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">How long in business</dt>
                  <dd className="mt-1 text-paper">{listing.yearsInBusiness}</dd>
                </div>
              )}
              {listing.specialty && (
                <div>
                  <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">Specializes in</dt>
                  <dd className="mt-1 text-paper">{listing.specialty}</dd>
                </div>
              )}
            </dl>
            {listing.profileContent && (
              <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-paper/90">{listing.profileContent}</div>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted">
            This listing is in the directory. After the owner runs Crawl Website, brand, license, years in business,
            and specialty land here.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-panel p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">PlaceFind profile</p>
        <dl className="mt-4 grid gap-3 text-sm">
          {listing.phone && (
            <div className="flex items-center gap-2 text-paper">
              <Phone className="h-4 w-4 text-muted" />
              {listing.phone}
            </div>
          )}
          {listing.website && (
            <a href={listing.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-brass hover:underline">
              <ExternalLink className="h-4 w-4" />
              Website
            </a>
          )}
          {listing.hours && <p className="text-muted">{listing.hours}</p>}
          {listing.keywords.length > 0 && <p className="text-paper/80">{listing.keywords.join(" · ")}</p>}
          <p className="text-xs text-muted">Directory listing · {LISTING_PRICE_LABEL}</p>
        </dl>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Reviews</p>
        <h3 className="mt-2 font-display text-2xl text-paper">
          {summary.count === 0 ? "Be the first to review" : `${summary.count} review${summary.count === 1 ? "" : "s"}`}
        </h3>
        <ul className="mt-4 grid gap-3">
          {reviews.map((review) => (
            <li key={review.id} className="rounded-xl border border-line bg-ink px-4 py-3">
              <p className="text-sm text-brass">
                {stars(review.rating)} <span className="text-paper">{review.authorName}</span>
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">{review.text}</p>
            </li>
          ))}
        </ul>
        <form
          className="mt-6 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            void submitReview()
          }}
        >
          <p className="text-sm text-paper">Leave a review</p>
          {reviewError && <p className="text-sm text-clay">{reviewError}</p>}
          <input
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder="Your name"
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
          />
          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Rating</span>
            <select
              value={rating}
              onChange={(event) => setRating(Number(event.target.value))}
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            >
              {[5, 4, 3, 2, 1].map((value) => (
                <option key={value} value={value}>
                  {value} {value === 1 ? "star" : "stars"}
                </option>
              ))}
            </select>
          </label>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={4}
            placeholder="What should a neighbor know?"
            className="rounded-lg border border-line bg-ink px-3 py-2 text-paper outline-none focus:border-brass"
          />
          <button
            type="submit"
            disabled={sending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
          >
            {sending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Star className="h-4 w-4" />}
            Post review
          </button>
        </form>
      </section>
    </article>
  )
}
