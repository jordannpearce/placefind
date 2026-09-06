import { ExternalLink, LoaderCircle, MapPin, Phone } from "lucide-react"
import { useEffect, useState } from "react"
import { loadListing } from "../lib/api.ts"
import { listingLocation, mapsStatusDetail, mapsStatusLabel } from "../lib/listings.ts"
import type { AuthUser, DirectoryListing } from "../lib/types.ts"

type Props = {
  listingId: string
  user: AuthUser | null
  onGo: (path: string) => void
}

export function ListingDetailPage({ listingId, user, onGo }: Props) {
  const [listing, setListing] = useState<DirectoryListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    void loadListing(listingId)
      .then(setListing)
      .catch((err) => {
        setListing(null)
        setError(err instanceof Error ? err.message : "Could not load that listing.")
      })
      .finally(() => setLoading(false))
  }, [listingId])

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
  const statusTone =
    listing.mapsStatus === "found" ? "text-moss" : listing.mapsStatus === "not_found" ? "text-clay" : "text-brass"

  return (
    <article className="mx-auto grid w-full max-w-3xl gap-6">
      <section className="rounded-2xl border border-line bg-panel p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">
          {listing.category || "PlaceFind listing"}
        </p>
        <h2 className="mt-2 font-display text-4xl text-paper">{listing.name}</h2>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
          <MapPin className="h-4 w-4" />
          {listingLocation(listing)}
        </p>
        <p className={`mt-4 text-sm font-semibold ${statusTone}`}>{mapsStatusLabel(listing.mapsStatus)}</p>
        <p className="mt-1 text-sm leading-6 text-muted">{mapsStatusDetail(listing)}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onGo("/directory")}
            className="h-11 rounded-lg border border-line px-4 text-sm text-paper hover:border-brass"
          >
            Directory
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => onGo(`/listings/${listing.id}/edit`)}
              className="h-11 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a]"
            >
              Edit and check Maps
            </button>
          )}
        </div>
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
          {!listing.phone && !listing.website && !listing.hours && listing.keywords.length === 0 && (
            <p className="text-muted">This profile is still light — name, city, and state are on file.</p>
          )}
        </dl>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Google Maps check</p>
        {listing.mapsStatus === "found" ? (
          <div className="mt-3">
            <p className="font-display text-xl text-paper">{listing.mapsTitle || listing.name}</p>
            {listing.mapsAddress && <p className="mt-1 text-sm text-muted">{listing.mapsAddress}</p>}
            {listing.mapsUrl && (
              <a href={listing.mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm text-brass hover:underline">
                <ExternalLink className="h-4 w-4" />
                Open on Google Maps
              </a>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted">{mapsStatusDetail(listing)}</p>
        )}
      </section>
    </article>
  )
}
