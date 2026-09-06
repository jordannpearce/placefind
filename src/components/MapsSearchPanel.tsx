import { LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { saveHostedKeys, testKeys } from "../lib/api.ts"
import type { HostedKeyStatus, KeyTestResult } from "../lib/types.ts"

type Props = {
  hosted: HostedKeyStatus | null
  onHosted: (hosted: HostedKeyStatus) => void
  onError: (message: string | null) => void
  onMessage: (message: string | null) => void
}

export function MapsSearchPanel({ hosted, onHosted, onError, onMessage }: Props) {
  const [scrappeyKey, setScrappeyKey] = useState("")
  const [dataforseoLogin, setDataforseoLogin] = useState("")
  const [dataforseoPassword, setDataforseoPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [results, setResults] = useState<KeyTestResult[]>([])

  useEffect(() => {
    setScrappeyKey("")
    setDataforseoLogin("")
    setDataforseoPassword("")
  }, [hosted?.scrappeyHint, hosted?.dataforseoHint])

  const keysReady = Boolean(hosted?.scrappey || hosted?.dataforseo)

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Maps search</p>
      <h3 className="mt-1 font-display text-2xl text-paper">Scan services</h3>
      <p className="mt-2 text-sm leading-6 text-muted">
        Paste the DataForSEO login, DataForSEO API password, and Scrappey key used for Test scan and rank tracking.
        Saved values stay on this server and, when a database is connected, in Postgres. On Railway also set
        DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, and SCRAPPEY_API_KEY on the placefind service — disk there is not
        durable. This page only shows a last-four hint.
      </p>
      {!hosted?.dataforseo && (
        <p className="mt-3 text-sm text-clay">
          Maps rank tracking is not configured. Save DataForSEO credentials here, or set the Railway variables, before
          a Track scan can run.
        </p>
      )}
      {keysReady && (
        <p className="mt-3 text-sm text-moss">
          Saved
          {hosted?.dataforseo ? ` · DataForSEO ${hosted.dataforseoHint}` : ""}
          {hosted?.scrappey ? ` · Scrappey ${hosted.scrappeyHint}` : ""}
        </p>
      )}
      <label className="mt-4 grid gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">DataForSEO login</span>
        <input
          value={dataforseoLogin}
          onChange={(event) => setDataforseoLogin(event.target.value)}
          placeholder={hosted?.dataforseoHint || "you@company.com"}
          autoComplete="off"
          className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
        />
      </label>
      <label className="mt-3 grid gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">DataForSEO API password</span>
        <input
          type="password"
          value={dataforseoPassword}
          onChange={(event) => setDataforseoPassword(event.target.value)}
          placeholder="API password, not your website password"
          autoComplete="new-password"
          className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
        />
      </label>
      <label className="mt-3 grid gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Scrappey key</span>
        <input
          type="password"
          value={scrappeyKey}
          onChange={(event) => setScrappeyKey(event.target.value)}
          placeholder={hosted?.scrappeyHint || "scp_…"}
          autoComplete="new-password"
          className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
        />
      </label>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={testing || saving}
          onClick={async () => {
            setTesting(true)
            onError(null)
            try {
              setResults(
                await testKeys({
                  scrappeyKey,
                  dataforseoLogin,
                  dataforseoPassword,
                  enrichWithScrappey: true,
                }),
              )
              onMessage("Connection test finished.")
            } catch (err) {
              setResults([])
              onError(err instanceof Error ? err.message : "Could not test scan services.")
            } finally {
              setTesting(false)
            }
          }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-brass text-sm font-semibold text-brass hover:bg-brass/10 disabled:opacity-60"
        >
          {testing && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {testing ? "Testing…" : "Test connection"}
        </button>
        <button
          type="button"
          disabled={saving || testing}
          onClick={async () => {
            setSaving(true)
            onError(null)
            try {
              const next = await saveHostedKeys({ scrappeyKey, dataforseoLogin, dataforseoPassword })
              onHosted(next.hosted)
              setScrappeyKey("")
              setDataforseoLogin("")
              setDataforseoPassword("")
              setResults([])
              onMessage(
                next.hosted.savedToDatabase
                  ? "Maps search keys saved on this server and in the database. On Railway, also keep DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, and SCRAPPEY_API_KEY on the placefind service."
                  : "Maps search keys saved on this server. On Railway, set DATAFORSEO_LOGIN, DATAFORSEO_PASSWORD, and SCRAPPEY_API_KEY on the placefind service so rank scans survive deploys.",
              )
            } catch (err) {
              onError(err instanceof Error ? err.message : "Could not save Maps search keys.")
            } finally {
              setSaving(false)
            }
          }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brass text-sm font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
        >
          {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {saving ? "Saving…" : "Save scan services"}
        </button>
      </div>
      {results.map((result) => (
        <p key={result.service} className={`mt-3 text-sm ${result.ok ? "text-moss" : "text-clay"}`}>
          {result.service === "dataforseo" ? "DataForSEO" : "Scrappey"}: {result.message}
        </p>
      ))}
    </section>
  )
}
