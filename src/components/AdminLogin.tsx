import { useState } from "react"
import { login, signup } from "../lib/api.ts"
import type { AuthUser } from "../lib/types.ts"

type Props = {
  bootstrap: boolean
  onAuthed: (user: AuthUser) => void
}

export function AdminLogin({ bootstrap, onAuthed }: Props) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border border-line bg-panel p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Admin</p>
      <h2 className="mt-2 font-display text-3xl text-paper">{bootstrap ? "Create the first admin" : "Admin sign in"}</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        {bootstrap
          ? "No accounts exist yet. Create the first admin to manage users and directory listings."
          : "Sign in with an admin account to manage users. This page stays empty until you are signed in."}
      </p>
      <form
        className="mt-6 grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault()
          setBusy(true)
          setError(null)
          try {
            const user = bootstrap
              ? await signup({ name, email, password })
              : await login({ email, password })
            if (user.role !== "admin") {
              setError("This account is not an admin.")
              return
            }
            onAuthed(user)
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not continue.")
          } finally {
            setBusy(false)
          }
        }}
      >
        {bootstrap && (
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
          {busy ? "Working…" : bootstrap ? "Create admin" : "Sign in"}
        </button>
      </form>
    </section>
  )
}
