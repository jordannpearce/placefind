import { useState } from "react"
import { login } from "../lib/api.ts"
import type { AuthUser } from "../lib/types.ts"

type Props = {
  mode?: "login" | "join"
  desktop?: boolean
  title?: string
  intro?: string
  onAuthed: (user: AuthUser) => void
  onGoBuy?: () => void
  onGoLogin?: () => void
  onGoJoin?: () => void
}

export function AuthPage({ desktop, title, intro, onAuthed, onGoBuy }: Props) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border border-line bg-panel p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Sign in</p>
      <h2 className="mt-2 font-display text-3xl text-paper">{title || (desktop ? "Sign in to PlaceFind" : "Welcome back")}</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        {intro ||
          (desktop
            ? "Use the email and password from when you bought PlaceFind. This app does not create accounts."
            : "Sign in to track ranks, see your license keys, and download the Windows setup.")}
      </p>
      <form
        className="mt-6 grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault()
          setBusy(true)
          setError(null)
          try {
            onAuthed(await login({ email, password }))
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not continue.")
          } finally {
            setBusy(false)
          }
        }}
      >
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
          />
        </label>
        {error && <p className="text-sm text-clay">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="h-11 rounded-lg bg-brass font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
        >
          {busy ? "Working…" : "Sign in"}
        </button>
      </form>
      {!desktop && onGoBuy && (
        <p className="mt-4 text-sm text-muted">
          Need a license?{" "}
          <button type="button" className="text-brass hover:underline" onClick={onGoBuy}>
            Buy PlaceFind
          </button>
          . Checkout creates your account.
        </p>
      )}
    </section>
  )
}
