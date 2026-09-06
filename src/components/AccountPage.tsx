import { useEffect, useState } from "react"
import { loadAccount, logout } from "../lib/api.ts"
import { listingLocation, listingPath, mapsStatusLabel } from "../lib/listings.ts"
import type { AuthUser, DirectoryListing } from "../lib/types.ts"

type Props = {
  user: AuthUser
  onLogout: () => void
  onGo: (path: string) => void
}

export function AccountPage({ user, onLogout, onGo }: Props) {
  const [listings, setListings] = useState<DirectoryListing[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadAccount()
      .then((account) => {
        setListings(account.listings ?? [])
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your account."))
  }, [])

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <section className="rounded-2xl border border-line bg-panel p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Your account</p>
        <h2 className="mt-2 font-display text-3xl text-paper">{user.name}</h2>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onGo("/listings/new")}
            className="h-11 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a]"
          >
            Create a listing
          </button>
          <button
            type="button"
            onClick={async () => {
              await logout()
              onLogout()
            }}
            className="h-11 rounded-lg border border-line px-4 text-sm text-paper hover:border-brass"
          >
            Sign out
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-panel p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Your listings</p>
        {error && <p className="mt-3 text-sm text-clay">{error}</p>}
        {listings.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No listings yet. Create a PlaceFind profile for your business, then confirm it on Google Maps.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {listings.map((listing) => (
              <li key={listing.id}>
                <button
                  type="button"
                  onClick={() => onGo(listingPath(listing.id))}
                  className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-left hover:border-brass/60"
                >
                  <p className="text-sm text-paper">{listing.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {listingLocation(listing)} · {mapsStatusLabel(listing.mapsStatus)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
