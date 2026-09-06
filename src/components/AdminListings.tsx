import { useState } from "react"
import { deleteListing } from "../lib/api.ts"
import { listingLocation, listingPath, mapsStatusLabel } from "../lib/listings.ts"
import type { DirectoryListing } from "../lib/types.ts"

type Props = {
  listings: DirectoryListing[]
  onListings: (listings: DirectoryListing[]) => void
  onError: (message: string | null) => void
  onMessage: (message: string | null) => void
  onGo: (path: string) => void
}

export function AdminListings({ listings, onListings, onError, onMessage, onGo }: Props) {
  const [busy, setBusy] = useState<string | null>(null)

  return (
    <section className="rounded-2xl border border-line bg-panel p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Directory</p>
      <h2 className="mt-1 font-display text-3xl text-paper">Manage listings</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        Public PlaceFind profiles. Remove a listing if it should not stay in the directory.
      </p>
      {listings.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No listings yet.</p>
      ) : (
        <ul className="mt-5 grid gap-2">
          {listings.map((listing) => (
            <li key={listing.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-ink px-4 py-3">
              <div>
                <button type="button" onClick={() => onGo(listingPath(listing))} className="text-left text-sm text-paper hover:text-brass">
                  {listing.name}
                </button>
                <p className="text-xs text-muted">
                  {listingLocation(listing)} · {mapsStatusLabel(listing.mapsStatus)}
                </p>
              </div>
              <button
                type="button"
                disabled={busy === listing.id}
                onClick={() => {
                  if (!window.confirm(`Remove ${listing.name} from the PlaceFind directory? This cannot be undone.`)) return
                  setBusy(listing.id)
                  onError(null)
                  void deleteListing(listing.id)
                    .then(() => {
                      onListings(listings.filter((row) => row.id !== listing.id))
                      onMessage(`Removed ${listing.name}.`)
                    })
                    .catch((err) => onError(err instanceof Error ? err.message : "Could not delete that listing."))
                    .finally(() => setBusy(null))
                }}
                className="text-sm text-clay hover:underline disabled:opacity-60"
              >
                {busy === listing.id ? "Removing…" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
