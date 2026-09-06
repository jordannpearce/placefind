import { useState } from "react"
import { login, signup } from "../lib/api.ts"
import type { AuthUser } from "../lib/types.ts"

type Props = {
  mode: "login" | "join"
  onAuthed: (user: AuthUser) => void
  onGoJoin: () => void
  onGoLogin: () => void
}

export function AuthPage({ mode, onAuthed, onGoJoin, onGoLogin }: Props) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const join = mode === "join"

  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border border-line bg-panel p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">{join ? "Create account" : "Sign in"}</p>
      <h2 className="mt-2 font-display text-3xl text-paper">{join ? "Get a PlaceFind account" : "Welcome back"}</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        {join
          ? "Create an account to buy a license key. You will get a welcome email if Resend is connected."
          : "Sign in to see your license keys and download the Windows setup."}
      </p>
      <form
        className="mt-6 grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault()
          setBusy(true)
          setError(null)
          try {
            onAuthed(join ? await signup({ name, email, password }) : await login({ email, password }))
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not continue.")
          } finally {
            setBusy(false)
          }
        }}
      >
        {join && (
          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            />
          </label>
        )}
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
          />
        </label>
        {error && <p className="text-sm text-clay">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="h-11 rounded-lg bg-brass font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
        >
          {busy ? "Working…" : join ? "Create account" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        {join ? "Already have an account?" : "Need an account?"}{" "}
        <button type="button" className="text-brass hover:underline" onClick={join ? onGoLogin : onGoJoin}>
          {join ? "Sign in" : "Create one"}
        </button>
      </p>
    </section>
  )
}
