import { useState } from "react"
import { forgotPassword, login } from "../lib/api.ts"
import type { AuthUser } from "../lib/types.ts"

type Props = {
  mode?: "login" | "join"
  desktop?: boolean
  title?: string
  intro?: string
  publicUrl?: string
  onAuthed: (user: AuthUser) => void
  onGoBuy?: () => void
  onGoLogin?: () => void
  onGoJoin?: () => void
}

export function AuthPage({ desktop, title, intro, publicUrl, onAuthed, onGoBuy }: Props) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<"login" | "forgot" | "sent">("login")
  const [notice, setNotice] = useState<string | null>(null)
  const websiteLogin = publicUrl ? `${publicUrl.replace(/\/$/, "")}/login` : ""

  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border border-line bg-panel p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">
        {view === "login" ? "Sign in" : "Password"}
      </p>
      <h2 className="mt-2 font-display text-3xl text-paper">
        {view === "login"
          ? title || (desktop ? "Sign in to PlaceFind" : "Welcome back")
          : "Forgot password"}
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        {view === "login"
          ? intro ||
            (desktop
              ? "Use the email and password from when you bought PlaceFind. This app does not create accounts."
              : "Sign in to track ranks, see your license keys, and download the Windows setup.")
          : "Enter the email on your PlaceFind account. If it is on file, we will send a one-time reset link."}
      </p>
      {view === "login" && (
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
      )}
      {view === "forgot" && (
        <form
          className="mt-6 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            setBusy(true)
            setError(null)
            try {
              const result = await forgotPassword(email)
              setNotice(result.message)
              setView("sent")
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not send a reset email.")
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
          {error && <p className="text-sm text-clay">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-lg bg-brass font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
          >
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
      {view === "sent" && (
        <p className="mt-6 rounded-xl border border-moss/40 bg-moss/10 px-4 py-3 text-sm leading-6 text-moss">
          {notice || "If that email is on file, we sent a reset link."}
          {desktop ? " Open the link from that email in a browser on the PlaceFind website." : ""}
        </p>
      )}
      {view === "login" ? (
        <p className="mt-4 text-sm text-muted">
          <button
            type="button"
            className="text-brass hover:underline"
            onClick={() => {
              setError(null)
              setView("forgot")
            }}
          >
            Forgot password
          </button>
          {desktop && websiteLogin && (
            <>
              {" · "}
              <a href={websiteLogin} target="_blank" rel="noreferrer" className="text-brass hover:underline">
                Reset on the website
              </a>
            </>
          )}
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted">
          <button
            type="button"
            className="text-brass hover:underline"
            onClick={() => {
              setError(null)
              setNotice(null)
              setView("login")
            }}
          >
            Back to sign in
          </button>
        </p>
      )}
      {view === "login" && !desktop && onGoBuy && (
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
