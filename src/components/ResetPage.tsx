import { useState } from "react"
import { resetPassword } from "../lib/api.ts"
import type { AuthUser } from "../lib/types.ts"

type Props = {
  desktop?: boolean
  publicUrl?: string
  onAuthed: (user: AuthUser) => void
  onGoLogin: () => void
}

export function ResetPage({ desktop, publicUrl, onAuthed, onGoLogin }: Props) {
  const token = new URLSearchParams(window.location.search).get("token") ?? ""
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(token ? null : "This reset link is missing a token.")

  const websiteReset = publicUrl ? `${publicUrl.replace(/\/$/, "")}/reset?token=${encodeURIComponent(token)}` : ""

  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border border-line bg-panel p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Password</p>
      <h2 className="mt-2 font-display text-3xl text-paper">Choose a new password</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        {desktop
          ? "Set a new password here, or open the same reset link on the PlaceFind website."
          : "Enter a new password for your PlaceFind account. This link works once and expires in one hour."}
      </p>
      {desktop && websiteReset && (
        <p className="mt-3 text-sm text-muted">
          Prefer the website?{" "}
          <a href={websiteReset} target="_blank" rel="noreferrer" className="text-brass hover:underline">
            Open this reset page in a browser
          </a>
          .
        </p>
      )}
      <form
        className="mt-6 grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault()
          if (password !== confirm) {
            setError("Those passwords do not match.")
            return
          }
          setBusy(true)
          setError(null)
          try {
            onAuthed(await resetPassword({ token, password }))
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not reset that password.")
          } finally {
            setBusy(false)
          }
        }}
      >
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">New password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Confirm password</span>
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
          />
        </label>
        {error && <p className="text-sm text-clay">{error}</p>}
        <button
          type="submit"
          disabled={busy || !token}
          className="h-11 rounded-lg bg-brass font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save new password"}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        <button type="button" className="text-brass hover:underline" onClick={onGoLogin}>
          Back to sign in
        </button>
      </p>
    </section>
  )
}
