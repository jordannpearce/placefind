import { useState } from "react"
import { joinHref, loginHref } from "../lib/account.ts"
import { signupBusiness } from "../lib/api.ts"
import { LISTING_PRICE_LABEL } from "../lib/pricing.ts"
import type { AuthUser } from "../lib/types.ts"

type Props = {
  onAuthed: (user: AuthUser) => void
  onGo: (path: string) => void
}

export function CreateProfilePage({ onAuthed, onGo }: Props) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const next = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("next")

  return (
    <section className="mx-auto grid w-full max-w-lg gap-5">
      <div className="rounded-2xl border border-brass/40 bg-raised p-6 sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Business owner</p>
        <h2 className="mt-2 font-display text-3xl text-paper">Create a Profile</h2>
        <p className="mt-3 text-sm leading-6 text-muted">
          Open a business owner account to publish and manage PlaceFind listings. An admin reviews new owner accounts
          before a listing can be published. After approval, you can add a listing and write the public profile
          neighbors open from the directory.
        </p>
        <ul className="mt-5 grid gap-2 text-sm leading-6 text-paper/85">
          <li className="rounded-xl border border-line bg-panel px-4 py-3">
            Publish a shop listing for {LISTING_PRICE_LABEL}
          </li>
          <li className="rounded-xl border border-line bg-panel px-4 py-3">
            Write the public article, HTML, and page title yourself
          </li>
          <li className="rounded-xl border border-line bg-panel px-4 py-3">
            Collect reviews and quote requests on the listing
          </li>
        </ul>
        <form
          className="mt-6 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            setBusy(true)
            setError(null)
            try {
              onAuthed(await signupBusiness({ name, email, password }))
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not create the profile account.")
            } finally {
              setBusy(false)
            }
          }}
        >
          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Your name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
              placeholder="Pat Ortega"
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="owner@yourshop.com"
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            />
          </label>
          {error && <p className="text-sm text-clay">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-lg bg-brass font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
          >
            {busy ? "Working…" : "Create a profile"}
          </button>
        </form>
        <p className="mt-4 text-sm text-muted">
          Already have an account?{" "}
          <button type="button" className="text-brass hover:underline" onClick={() => onGo(loginHref(next))}>
            Sign in
          </button>
        </p>
        <p className="mt-2 text-sm text-muted">
          Here to leave reviews?{" "}
          <button type="button" className="text-brass hover:underline" onClick={() => onGo(joinHref("member", next))}>
            Join free
          </button>
        </p>
      </div>
    </section>
  )
}
