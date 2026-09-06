import { useEffect, useState } from "react"
import { accountKindOf, canPublishListing } from "../lib/account.ts"
import { becomeBusinessAccount, deleteListing, loadAccount, logout } from "../lib/api.ts"
import { listingLocation, listingPath, mapsStatusLabel } from "../lib/listings.ts"
import { LISTING_PRICE_LABEL } from "../lib/pricing.ts"
import type { AccountUsage, AuthUser, DirectoryListing } from "../lib/types.ts"
import { OwnerDeskTools } from "./OwnerDeskTools.tsx"
import { UsageCard } from "./UsageCard.tsx"

type Props = {
  user: AuthUser
  onUser?: (user: AuthUser) => void
  onLogout: () => void
  onGo: (path: string) => void
}

export function AccountPage({ user, onUser, onLogout, onGo }: Props) {
  const [listings, setListings] = useState<DirectoryListing[]>([])
  const [usage, setUsage] = useState<AccountUsage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [usageLoading, setUsageLoading] = useState(true)
  const [upgradeBusy, setUpgradeBusy] = useState(false)
  const owner = canPublishListing(user)
  const kind = accountKindOf(user)

  useEffect(() => {
    void loadAccount()
      .then((account) => {
        setListings(account.listings ?? [])
        if (account.usage) setUsage(account.usage)
        else setUsageError("Monthly usage is not available yet.")
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Could not load your account."
        setError(message)
        setUsageError(message)
      })
      .finally(() => setUsageLoading(false))
  }, [])

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <section className="rounded-2xl border border-line bg-panel p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Your account</p>
        <h2 className="mt-2 font-display text-3xl text-paper">{user.name}</h2>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
        <p className="mt-3 text-sm leading-6 text-paper/80">
          {owner
            ? `Business account. A PlaceFind listing is ${LISTING_PRICE_LABEL}.`
            : "Free neighbor account. Leave reviews and request quotes — PlaceFind does not charge this account."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {user.role === "admin" && (
            <button
              type="button"
              onClick={() => onGo("/admin")}
              className="h-11 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a]"
            >
              Manage accounts
            </button>
          )}
          {owner ? (
            <>
              <button
                type="button"
                onClick={() => onGo("/listings/new")}
                className={`h-11 rounded-lg px-4 font-semibold ${user.role === "admin" ? "border border-line text-paper hover:border-brass" : "bg-brass text-ink hover:bg-[#ecc77a]"}`}
              >
                Create a listing
              </button>
              <button
                type="button"
                onClick={() => onGo("/dashboard")}
                className="h-11 rounded-lg border border-line px-4 text-sm text-paper hover:border-brass"
              >
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => onGo("/track")}
                className="h-11 rounded-lg border border-line px-4 text-sm text-paper hover:border-brass"
              >
                Rank tracker
              </button>
              <button
                type="button"
                onClick={() => onGo("/track#traffic")}
                className="h-11 rounded-lg border border-line px-4 text-sm text-paper hover:border-brass"
              >
                Traffic
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={upgradeBusy}
              onClick={() => {
                setUpgradeBusy(true)
                void becomeBusinessAccount()
                  .then((next) => {
                    onUser?.(next)
                    onGo("/listings/new")
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : "Could not switch this account."))
                  .finally(() => setUpgradeBusy(false))
              }}
              className="h-11 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
            >
              {upgradeBusy ? "Working…" : `List a business · ${LISTING_PRICE_LABEL}`}
            </button>
          )}
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

      {owner && (
        <section className="rounded-2xl border border-line bg-panel p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Owner tools</p>
          <h3 className="mt-2 font-display text-2xl text-paper">Rank tracker and Traffic</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Signed-in owners can scan a rank grid and start Traffic from the tracker. These tools stay off the public
            directory.
          </p>
          <div className="mt-4">
            <OwnerDeskTools onGo={onGo} />
          </div>
        </section>
      )}

      {owner && <UsageCard usage={usage} error={usageError} loading={usageLoading} />}

      {kind === "member" && (
        <section className="rounded-2xl border border-line bg-panel p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Reviews and quotes</p>
          <h3 className="mt-2 font-display text-2xl text-paper">No listing fee on this account</h3>
          <p className="mt-3 text-sm leading-6 text-muted">
            Use this account to review shops and ask for quotes. Browse the directory, open a profile, and write as
            yourself. If you own a shop, switch to a business listing for {LISTING_PRICE_LABEL}.
          </p>
          <button type="button" onClick={() => onGo("/directory")} className="mt-4 text-sm text-brass hover:underline">
            Open the directory
          </button>
        </section>
      )}

      {owner && (
      <section className="rounded-2xl border border-line bg-panel p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Your listings</p>
        {error && <p className="mt-3 text-sm text-clay">{error}</p>}
        {listings.length === 0 ? (
          <p className="mt-3 text-sm text-muted">
            No listings yet. A PlaceFind listing is $150 per month. Create one, then open Crawl Website to write a
            public profile article. The listing form stays as you entered it.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {listings.map((listing) => (
              <li key={listing.id} className="rounded-xl border border-line bg-ink px-4 py-3">
                <button
                  type="button"
                  onClick={() => onGo(listingPath(listing))}
                  className="w-full text-left hover:text-brass"
                >
                  <p className="text-sm text-paper">{listing.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {listingLocation(listing)} · {mapsStatusLabel(listing.mapsStatus)}
                  </p>
                </button>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => onGo(`${listingPath(listing)}/edit`)}
                    className="text-xs text-brass hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm(`Remove ${listing.name} from the PlaceFind directory? This cannot be undone.`)) return
                      void deleteListing(listing.id)
                        .then(() => setListings((rows) => rows.filter((row) => row.id !== listing.id)))
                        .catch((err) => setError(err instanceof Error ? err.message : "Could not delete that listing."))
                    }}
                    className="text-xs text-clay hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}
    </div>
  )
}
