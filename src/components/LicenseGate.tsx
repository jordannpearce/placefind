import { KeyRound, LoaderCircle } from "lucide-react"
import { useState } from "react"
import { activateLicenseKey } from "../lib/api.ts"
import type { LicenseStatus } from "../lib/types.ts"

type Props = {
  license: LicenseStatus
  onActivated: (license: LicenseStatus) => void
}

export function LicenseGate({ license, onActivated }: Props) {
  const [key, setKey] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(license.detail && license.code !== "NOT_FOUND" ? license.detail : null)

  return (
    <section className="mx-auto w-full max-w-xl rounded-2xl border border-line bg-panel p-8">
      <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">
        <KeyRound className="h-3.5 w-3.5" />
        License key
      </p>
      <h2 className="mt-2 font-display text-3xl text-paper">Unlock PlaceFind</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        Enter the license key you received with this copy. Lookup and rank tracking stay locked until the key is valid.
      </p>
      <form
        className="mt-6 grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault()
          setBusy(true)
          setError(null)
          try {
            onActivated(await activateLicenseKey(key))
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not activate that key.")
          } finally {
            setBusy(false)
          }
        }}
      >
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">PlaceFind license key</span>
          <input
            value={key}
            onChange={(event) => setKey(event.target.value)}
            placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX-XXXXXX-XX"
            autoComplete="off"
            spellCheck={false}
            className="h-12 rounded-lg border border-line bg-ink px-3 font-mono text-sm text-paper outline-none focus:border-brass"
          />
        </label>
        {error && <p className="text-sm text-clay">{error}</p>}
        <button
          type="submit"
          disabled={busy || key.trim().length < 8}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brass font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
        >
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {busy ? "Checking key…" : "Activate license"}
        </button>
      </form>
    </section>
  )
}
