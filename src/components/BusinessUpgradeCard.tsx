import { useState } from "react"
import { becomeBusinessAccount } from "../lib/api.ts"
import { LISTING_PRICE_LABEL } from "../lib/pricing.ts"
import type { AuthUser } from "../lib/types.ts"

type Props = {
  user: AuthUser
  onUpgraded: (user: AuthUser) => void
  onGo: (path: string) => void
}

export function BusinessUpgradeCard({ user, onUpgraded, onGo }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <section className="mx-auto w-full max-w-xl rounded-2xl border border-line bg-panel p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Free neighbor account</p>
      <h2 className="mt-2 font-display text-3xl text-paper">This account is not billed</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        {user.name}, you can leave reviews and request quotes for free. PlaceFind does not charge $150 for that. A
        business listing is {LISTING_PRICE_LABEL} and uses a business account.
      </p>
      {error && <p className="mt-4 text-sm text-clay">{error}</p>}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            setError(null)
            void becomeBusinessAccount()
              .then((next) => {
                onUpgraded(next)
                onGo("/listings/new")
              })
              .catch((err) => {
                setError(err instanceof Error ? err.message : "Could not switch this account.")
              })
              .finally(() => setBusy(false))
          }}
          className="h-11 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
        >
          {busy ? "Working…" : `List a business · ${LISTING_PRICE_LABEL}`}
        </button>
        <button
          type="button"
          onClick={() => onGo("/directory")}
          className="h-11 rounded-lg border border-line px-4 text-sm text-paper hover:border-brass"
        >
          Back to the directory
        </button>
      </div>
    </section>
  )
}
