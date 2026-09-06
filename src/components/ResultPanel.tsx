import { Check, Copy, ExternalLink, MapPin, Phone, Star } from "lucide-react"
import { useState } from "react"
import type { BusinessListing, SearchResponse } from "../lib/types.ts"

function sourceLabel(source: BusinessListing["source"]) {
  if (source === "dataforseo") return "DataForSEO"
  if (source === "scrappey") return "Scrappey"
  return "Sample"
}

async function copyText(value: string) {
  await navigator.clipboard.writeText(value)
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await copyText(value)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1400)
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-paper/80 hover:border-brass hover:text-brass"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </button>
  )
}

function ListingCard({ listing, featured }: { listing: BusinessListing; featured?: boolean }) {
  return (
    <article className={`rounded-2xl border p-5 ${featured ? "border-brass/50 bg-raised" : "border-line bg-panel"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {featured && (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Best match</p>
          )}
          <h3 className="font-display text-2xl font-medium text-paper">{listing.title}</h3>
          <p className="mt-1 flex items-start gap-2 text-sm text-muted">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            {listing.address}
          </p>
        </div>
        <span className="rounded-full border border-line px-2 py-1 text-[11px] uppercase tracking-wide text-muted">
          {sourceLabel(listing.source)}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {listing.rating != null && (
          <span className="inline-flex items-center gap-1 text-brass">
            <Star className="h-4 w-4 fill-current" />
            {listing.rating.toFixed(1)}
            {listing.reviewCount != null && (
              <span className="text-muted">({listing.reviewCount.toLocaleString()})</span>
            )}
          </span>
        )}
        {listing.category && <span className="text-paper/80">{listing.category}</span>}
        {listing.currentStatus && <span className="capitalize text-moss">{listing.currentStatus}</span>}
        {listing.claimed != null && (
          <span className={listing.claimed ? "text-moss" : "text-clay"}>{listing.claimed ? "Claimed" : "Unclaimed"}</span>
        )}
        {listing.priceLevel && <span className="capitalize text-muted">{listing.priceLevel.replaceAll("_", " ")}</span>}
      </div>

      {listing.phone && (
        <p className="mt-3 inline-flex items-center gap-2 text-sm text-paper">
          <Phone className="h-4 w-4 text-muted" />
          {listing.phone}
        </p>
      )}

      {listing.hours && <p className="mt-2 text-sm text-muted">{listing.hours}</p>}

      {listing.hoursDetail && listing.hoursDetail.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-2">
          {listing.hoursDetail.map((row) => (
            <div key={row.day} className="flex justify-between gap-3">
              <dt>{row.day}</dt>
              <dd className="text-paper/80">{row.hours}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <CopyButton value={listing.address} label="Copy address" />
        {listing.phone && <CopyButton value={listing.phone} label="Copy phone" />}
        {listing.placeId && <CopyButton value={listing.placeId} label="Copy place ID" />}
        <a
          href={listing.mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md bg-paper px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-white"
        >
          Open in Maps
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        {listing.website && (
          <a
            href={listing.website}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs text-paper/80 hover:border-brass"
          >
            Website
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </article>
  )
}

type Props = {
  loading: boolean
  result: SearchResponse | null
  error: string | null
}

export function ResultPanel({ loading, result, error }: Props) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-8">
        <p className="font-display text-2xl text-paper">Looking up the listing</p>
        <ol className="mt-5 space-y-3 text-sm text-muted">
          <li className="flex gap-3">
            <span className="mt-1 h-2 w-2 rounded-full bg-brass" />
            Asking DataForSEO for Google Maps results in that city
          </li>
          <li className="flex gap-3">
            <span className="mt-1 h-2 w-2 animate-pulse rounded-full bg-brass/50" />
            Opening the listing page with Scrappey when a key is saved
          </li>
        </ol>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-clay/40 bg-panel p-8">
        <p className="font-display text-2xl text-paper">Search did not finish</p>
        <p className="mt-2 text-sm text-muted">{error}</p>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-panel/60 p-8">
        <p className="font-display text-3xl text-paper">Find a Google Maps listing</p>
        <p className="mt-3 max-w-md text-sm leading-6 text-muted">
          Type the business name, city, and state. PlaceFind searches Maps through DataForSEO, then uses Scrappey to
          open the listing page and fill in extra details.
        </p>
      </div>
    )
  }

  if (!result.best) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-8">
        <p className="font-display text-2xl text-paper">No listing matched</p>
        <p className="mt-2 text-sm text-muted">
          {result.error || result.warning || "Check the spelling, or try a closer city name."}
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {result.warning && (
        <p className="rounded-xl border border-brass/30 bg-brass/10 px-4 py-3 text-sm text-brass">{result.warning}</p>
      )}
      <ListingCard listing={result.best} featured />
      {result.others.length > 0 && (
        <div className="grid gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Other matches</p>
          {result.others.map((listing) => (
            <ListingCard key={`${listing.placeId || listing.title}-${listing.address}`} listing={listing} />
          ))}
        </div>
      )}
    </div>
  )
}
