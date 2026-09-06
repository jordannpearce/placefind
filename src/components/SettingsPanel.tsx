import { X } from "lucide-react"
import { useState } from "react"
import { testKeys } from "../lib/api.ts"
import type { ApiKeys, KeyTestResult } from "../lib/types.ts"

type Props = {
  open: boolean
  keys: ApiKeys
  onChange: (keys: ApiKeys) => void
  onClose: () => void
}

export function SettingsPanel({ open, keys, onChange, onClose }: Props) {
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<KeyTestResult[]>([])
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50">
      <aside className="flex h-full w-full max-w-md flex-col border-l border-line bg-panel p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Settings</p>
            <h2 className="font-display text-2xl text-paper">API keys</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-muted hover:bg-raised hover:text-paper">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 overflow-y-auto pr-1">
          <p className="text-sm leading-6 text-muted">
            Optional. If the seller already put keys in this copy, you can leave these blank and search. Otherwise paste
            a Scrappey key and a DataForSEO login plus API password.
          </p>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Scrappey API key</span>
            <input
              type="password"
              value={keys.scrappeyKey}
              onChange={(event) => onChange({ ...keys, scrappeyKey: event.target.value })}
              placeholder="scp_…"
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">DataForSEO login</span>
            <input
              value={keys.dataforseoLogin}
              onChange={(event) => onChange({ ...keys, dataforseoLogin: event.target.value })}
              placeholder="you@company.com"
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">DataForSEO API password</span>
            <input
              type="password"
              value={keys.dataforseoPassword}
              onChange={(event) => onChange({ ...keys, dataforseoPassword: event.target.value })}
              placeholder="API password, not your site password"
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            />
          </label>

          <label className="flex items-start gap-3 text-sm text-paper/80">
            <input
              type="checkbox"
              checked={keys.enrichWithScrappey}
              onChange={(event) => onChange({ ...keys, enrichWithScrappey: event.target.checked })}
              className="mt-1"
            />
            After DataForSEO finds a listing, open the Maps page with Scrappey for extra details
          </label>

          <button
            type="button"
            disabled={testing}
            onClick={async () => {
              setTesting(true)
              setError(null)
              try {
                setResults(await testKeys(keys))
              } catch (err) {
                setResults([])
                setError(err instanceof Error ? err.message : "Could not test keys.")
              } finally {
                setTesting(false)
              }
            }}
            className="h-11 rounded-lg border border-brass text-sm font-semibold text-brass hover:bg-brass/10 disabled:opacity-60"
          >
            {testing ? "Testing…" : "Test connection"}
          </button>

          {error && <p className="text-sm text-clay">{error}</p>}
          {results.map((result) => (
            <p key={result.service} className={`text-sm ${result.ok ? "text-moss" : "text-clay"}`}>
              {result.service === "dataforseo" ? "DataForSEO" : "Scrappey"}: {result.message}
            </p>
          ))}
        </div>
      </aside>
    </div>
  )
}
