import { useState } from "react"
import type { JoinIntent } from "../lib/account.ts"
import { forgotPassword, login, signup } from "../lib/api.ts"
import type { AuthUser } from "../lib/types.ts"

type Props = {
  mode?: "login" | "join"
  title?: string
  intro?: string
  publicUrl?: string
  joinIntent?: JoinIntent
  onAuthed: (user: AuthUser) => void
  onGoLogin?: () => void
  onGoJoin?: () => void
}

export function AuthPage({ mode = "login", title, intro, joinIntent = "business", onAuthed, onGoLogin, onGoJoin }: Props) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<"login" | "join" | "forgot" | "sent">(mode === "join" ? "join" : "login")
  const [notice, setNotice] = useState<string | null>(null)

  if (mode === "join" && view === "login") {
    // Keep local view; parent mode only sets the first paint.
  }

  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border border-line bg-panel p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">
        {view === "join" ? "Join" : view === "login" ? "Sign in" : "Password"}
      </p>
      <h2 className="mt-2 font-display text-3xl text-paper">
        {view === "join"
          ? title || "Create your account"
          : view === "login"
            ? title || "Welcome back"
            : "Forgot password"}
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        {view === "join"
          ? intro ||
            (joinIntent === "member"
              ? "Create a free PlaceFind account to leave reviews. Anyone can request a quote. This account is not billed. Listing a business is $150 per month on a separate business account."
              : "Create a PlaceFind account to list your business for $150 per month.")
          : view === "login"
            ? intro || "Sign in to manage a listing or leave a review. Anyone can request a quote."
            : "Enter the email on your PlaceFind account. If it is on file, we will send a one-time reset link."}
      </p>
      {view === "join" && (
        <form
          className="mt-6 grid gap-3"
          onSubmit={async (event) => {
            event.preventDefault()
            setBusy(true)
            setError(null)
            try {
              onAuthed(await signup({ name, email, password, kind: joinIntent === "member" ? "member" : "business" }))
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not create the account.")
            } finally {
              setBusy(false)
            }
          }}
        >
          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
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
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            />
          </label>
          {error && <p className="text-sm text-clay">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="h-11 rounded-lg bg-brass font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
          >
            {busy ? "Working…" : "Create account"}
          </button>
        </form>
      )}
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
          {" · "}
          <button
            type="button"
            className="text-brass hover:underline"
            onClick={() => {
              setError(null)
              setView("join")
              onGoJoin?.()
            }}
          >
            Create an account
          </button>
        </p>
      ) : view === "join" ? (
        <p className="mt-4 text-sm text-muted">
          Already have an account?{" "}
          <button
            type="button"
            className="text-brass hover:underline"
            onClick={() => {
              setError(null)
              setView("login")
              onGoLogin?.()
            }}
          >
            Sign in
          </button>
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
    </section>
  )
}
