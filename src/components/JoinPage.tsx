import { useState } from "react"
import { createProfileHref, loginHref } from "../lib/account.ts"
import { signup } from "../lib/api.ts"
import type { AuthUser } from "../lib/types.ts"

type Props = {
  onAuthed: (user: AuthUser) => void
  onGo: (path: string) => void
}

export function JoinPage({ onAuthed, onGo }: Props) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const next = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("next")

  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border border-line bg-panel p-6 sm:p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Neighbor account</p>
      <h2 className="mt-2 font-display text-3xl text-paper">Join PlaceFind</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        Create a free neighbor account to leave reviews on shops in the directory. Anyone can request a quote without
        signing up. This account is not billed. An admin reviews new neighbor accounts before reviews go live.
      </p>
      <ul className="mt-5 grid gap-2 text-sm leading-6 text-paper/85">
        <li className="rounded-xl border border-line bg-ink px-4 py-3">Leave a named review on a listing</li>
        <li className="rounded-xl border border-line bg-ink px-4 py-3">Keep your name and email on the review desk</li>
        <li className="rounded-xl border border-line bg-ink px-4 py-3">Quotes stay open to anyone — no account required</li>
      </ul>
      <form
        className="mt-6 grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault()
          setBusy(true)
          setError(null)
          try {
            onAuthed(await signup({ name, email, password }))
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create the account.")
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
            placeholder="Maya Chen"
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
            placeholder="you@email.com"
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
          {busy ? "Working…" : "Join PlaceFind"}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Already have an account?{" "}
        <button type="button" className="text-brass hover:underline" onClick={() => onGo(loginHref(next))}>
          Sign in
        </button>
      </p>
      <p className="mt-2 text-sm text-muted">
        Own a shop?{" "}
        <button type="button" className="text-brass hover:underline" onClick={() => onGo(createProfileHref(next))}>
          Create a Profile
        </button>
      </p>
    </section>
  )
}
