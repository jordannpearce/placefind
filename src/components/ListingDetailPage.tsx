import { ExternalLink, LoaderCircle, Mail, MapPin, Phone, Star } from "lucide-react"
import { useEffect, useState } from "react"
import { joinHref, loginHref } from "../lib/account.ts"
import { createListingReview, loadListing, requestListingQuote } from "../lib/api.ts"
import { listingLocation, listingPath, listingRedirectPath, mapsStatusDetail } from "../lib/listings.ts"
import { LISTING_PRICE_LABEL } from "../lib/pricing.ts"
import {
  applyListingDocumentHead,
  listingBusinessName,
  listingHasEnhancedProfile,
  listingProfileHeadings,
  renderProfileArticle,
  sanitizeOwnerHtml,
  stripCrawlArticleFooter,
} from "../lib/profile.ts"
import { MISSING_QUOTE_EMAIL_MESSAGE } from "../lib/quotes.ts"
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
  const [rating, setRating] = useState(5)
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)
  const [quoteName, setQuoteName] = useState(user?.name ?? "")
  const [quoteEmail, setQuoteEmail] = useState(user?.email ?? "")
  const [quotePhone, setQuotePhone] = useState("")
  const [quoteNeed, setQuoteNeed] = useState("")
  const [quoteSending, setQuoteSending] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [quoteSent, setQuoteSent] = useState(false)

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

  useEffect(() => {
    if (!listing) return
    return applyListingDocumentHead(listing, typeof window !== "undefined" ? window.location.href : undefined)
  }, [listing])

  async function submitReview() {
    setSending(true)
    setReviewError(null)
    try {
      const payload = await createListingReview(listingId, { rating, text })
      setReviews(payload.reviews)
      setSummary(payload.reviewSummary)
      setText("")
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Could not save that review.")
    } finally {
      setSending(false)
    }
  }

  async function submitQuote() {
    setQuoteSending(true)
    setQuoteError(null)
    setQuoteSent(false)
    try {
      await requestListingQuote(listingId, {
        name: quoteName,
        email: quoteEmail,
        phone: quotePhone,
        need: quoteNeed,
      })
      setQuoteSent(true)
      setQuoteNeed("")
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : "Could not send that quote request.")
    } finally {
      setQuoteSending(false)
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
  const article = stripCrawlArticleFooter(listing.profileContent ?? "")
  const articleHtml = renderProfileArticle(article)
  const customHtml = sanitizeOwnerHtml(listing.profileHtml ?? "")
  const profileHeadings = listingProfileHeadings(listing)
  const enhanced = listingHasEnhancedProfile(listing)
  const businessName = listingBusinessName(listing)

  return (
    <article className="mx-auto grid w-full max-w-3xl gap-6">
      <section className="rounded-2xl border border-line bg-panel p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">
          {listing.category || "PlaceFind listing"}
        </p>
        <h1 className="mt-2 font-display text-4xl text-paper">{businessName}</h1>
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
          <div className="mt-4 grid gap-4">
            {profileHeadings.map((row) => {
              const Tag = `h${row.level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
              return (
                <Tag key={`h${row.level}`} className="profile-heading">
                  {row.text}
                </Tag>
              )
            })}
            {articleHtml ? <div className="profile-html" dangerouslySetInnerHTML={{ __html: articleHtml }} /> : null}
            {customHtml ? <div className="profile-html" dangerouslySetInnerHTML={{ __html: customHtml }} /> : null}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted">
            This listing is in the directory. The owner can write headings, the public article, custom HTML, and page
            title from Edit listing. Crawl Website can draft an article from the shop site, but it will not replace a
            profile the owner has already customized.
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
          {listing.email && (
            <div className="flex items-center gap-2 text-paper">
              <Mail className="h-4 w-4 text-muted" />
              {listing.email}
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
        {reviews.length === 0 ? (
          <p className="mt-4 text-sm leading-6 text-muted">No reviews yet. Neighbors who sign in can leave the first one.</p>
        ) : (
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
        )}
        {user ? (
          <form
            className="mt-6 grid gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              void submitReview()
            }}
          >
            <p className="text-sm text-paper">Leave a review as {user.name}</p>
            {reviewError && <p className="text-sm text-clay">{reviewError}</p>}
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
        ) : (
          <div className="mt-6 rounded-xl border border-line bg-ink px-4 py-4">
            <p className="text-sm leading-6 text-paper">Reviews come from PlaceFind accounts so shops can trust the desk.</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Sign in or create a free neighbor account to leave a review. PlaceFind does not charge $150 for reviews or
              quotes.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => onGo(loginHref(listingPath(listing)))}
                className="h-11 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a]"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => onGo(joinHref("member", listingPath(listing)))}
                className="h-11 rounded-lg border border-line px-4 text-sm text-paper hover:border-brass"
              >
                Join free
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-panel p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Request a quote</p>
        <h3 className="mt-2 font-display text-2xl text-paper">Ask this shop for a quote</h3>
        {listing.hasQuoteEmail === false ? (
          <p className="mt-3 text-sm leading-6 text-muted">{MISSING_QUOTE_EMAIL_MESSAGE}</p>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-muted">
              Tell them what you need. PlaceFind sends your note to the contact email on this listing. The shop writes you back themselves. Quote requests use a free account — not a $150 listing.
            </p>
            {quoteSent && (
              <p className="mt-4 rounded-xl border border-moss/40 bg-moss/10 px-4 py-3 text-sm text-moss">
                Sent. The shop can write you at the email you left.
              </p>
            )}
            {!user ? (
              <div className="mt-5 rounded-xl border border-line bg-ink px-4 py-4">
                <p className="text-sm leading-6 text-muted">
                  Sign in or create a free neighbor account to request a quote. PlaceFind does not bill that account.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onGo(loginHref(listingPath(listing)))}
                    className="h-11 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a]"
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => onGo(joinHref("member", listingPath(listing)))}
                    className="h-11 rounded-lg border border-line px-4 text-sm text-paper hover:border-brass"
                  >
                    Join free
                  </button>
                </div>
              </div>
            ) : (
            <form
              className="mt-5 grid gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                void submitQuote()
              }}
            >
              {quoteError && <p className="text-sm text-clay">{quoteError}</p>}
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Your name</span>
                <input
                  value={quoteName}
                  onChange={(event) => setQuoteName(event.target.value)}
                  autoComplete="name"
                  className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Email</span>
                <input
                  type="email"
                  value={quoteEmail}
                  onChange={(event) => setQuoteEmail(event.target.value)}
                  autoComplete="email"
                  className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Phone (optional)</span>
                <input
                  value={quotePhone}
                  onChange={(event) => setQuotePhone(event.target.value)}
                  autoComplete="tel"
                  className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">What do you need?</span>
                <textarea
                  value={quoteNeed}
                  onChange={(event) => setQuoteNeed(event.target.value)}
                  rows={4}
                  placeholder="Two dozen sandwich loaves for a Friday office lunch, ready before 10 a.m."
                  className="rounded-lg border border-line bg-ink px-3 py-2 text-paper outline-none focus:border-brass"
                />
              </label>
              <button
                type="submit"
                disabled={quoteSending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
              >
                {quoteSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Request a quote
              </button>
            </form>
            )}
          </>
        )}
      </section>
    </article>
  )
}
