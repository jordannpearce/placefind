import { Check, Copy, KeyRound, LoaderCircle } from "lucide-react"
import { useState } from "react"
import { assignLicense, saveKeygen, testKeygen } from "../lib/api.ts"
import type { InstallerStatus, IssuedLicense, KeygenStatus } from "../lib/types.ts"

type Props = {
  keygen: KeygenStatus | null
  issued: IssuedLicense[]
  installerRunning: boolean
  onKeygen: (keygen: KeygenStatus) => void
  onIssued: (issued: IssuedLicense[]) => void
  onInstaller: (installer: InstallerStatus) => void
  onError: (message: string | null) => void
}

export function KeygenPanel({ keygen, issued = [], installerRunning, onKeygen, onIssued, onInstaller, onError }: Props) {
  const [accountId, setAccountId] = useState("")
  const [productId, setProductId] = useState("")
  const [policyId, setPolicyId] = useState("")
  const [token, setToken] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [testMessage, setTestMessage] = useState<string | null>(null)
  const [testOk, setTestOk] = useState<boolean | null>(null)
  const [latest, setLatest] = useState<IssuedLicense | null>(null)
  const [copied, setCopied] = useState("")

  const connected = Boolean(keygen?.connected)
  const canIssue = Boolean(keygen?.canIssue)

  async function copy(value: string, id: string) {
    await navigator.clipboard.writeText(value)
    setCopied(id)
    window.setTimeout(() => setCopied((current) => (current === id ? "" : current)), 1600)
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-6">
      <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">
        <KeyRound className="h-3.5 w-3.5" />
        License keys
      </p>
      <h2 className="mt-1 font-display text-3xl text-paper">Assign Keygen licenses</h2>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
        Connect your Keygen.sh product, then create one license key per buyer. Send them the Setup file and that key.
        The admin token stays on this computer. The Windows installer only gets your public account and product IDs so
        the app can check keys.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-line bg-ink p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Connect Keygen</p>
          {connected && (
            <p className="mt-2 text-sm text-moss">
              Connected{keygen?.accountId ? ` · account ${keygen.accountId.slice(0, 8)}…` : ""}
              {keygen?.tokenHint ? ` · token ${keygen.tokenHint}` : ""}
            </p>
          )}
          <label className="mt-4 grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Account ID</span>
            <input
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              placeholder={keygen?.accountId || "uuid from keygen.sh"}
              className="h-11 rounded-lg border border-line bg-panel px-3 text-paper outline-none focus:border-brass"
            />
          </label>
          <label className="mt-3 grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Product ID</span>
            <input
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              placeholder={keygen?.productId || "PlaceFind product uuid"}
              className="h-11 rounded-lg border border-line bg-panel px-3 text-paper outline-none focus:border-brass"
            />
          </label>
          <label className="mt-3 grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Policy ID</span>
            <input
              value={policyId}
              onChange={(event) => setPolicyId(event.target.value)}
              placeholder={keygen?.policyId || "license policy uuid"}
              className="h-11 rounded-lg border border-line bg-panel px-3 text-paper outline-none focus:border-brass"
            />
          </label>
          <label className="mt-3 grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Admin or product token</span>
            <input
              type="password"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={keygen?.tokenHint || "prod- or admin- token"}
              className="h-11 rounded-lg border border-line bg-panel px-3 text-paper outline-none focus:border-brass"
            />
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={testing}
              onClick={async () => {
                setTesting(true)
                onError(null)
                try {
                  const result = await testKeygen({ accountId, productId, policyId, token })
                  setTestOk(result.ok)
                  setTestMessage(result.message)
                } catch (err) {
                  setTestOk(false)
                  setTestMessage(err instanceof Error ? err.message : "Could not reach Keygen.")
                } finally {
                  setTesting(false)
                }
              }}
              className="h-11 rounded-lg border border-brass text-sm font-semibold text-brass hover:bg-brass/10 disabled:opacity-60"
            >
              {testing ? "Testing…" : "Test connection"}
            </button>
            <button
              type="button"
              disabled={saving || installerRunning}
              onClick={async () => {
                setSaving(true)
                onError(null)
                try {
                  const next = await saveKeygen({ accountId, productId, policyId, token })
                  onKeygen(next.keygen)
                  onIssued(next.issued)
                  onInstaller(next.installer)
                  setAccountId("")
                  setProductId("")
                  setPolicyId("")
                  setToken("")
                  setTestOk(true)
                  setTestMessage("Saved. Buyer copies will ask for a Keygen license key.")
                } catch (err) {
                  onError(err instanceof Error ? err.message : "Could not save Keygen settings.")
                } finally {
                  setSaving(false)
                }
              }}
              className="h-11 rounded-lg bg-brass text-sm font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
            >
              {saving || installerRunning ? "Saving…" : "Save Keygen"}
            </button>
          </div>
          {testMessage && <p className={`mt-3 text-sm ${testOk ? "text-moss" : "text-clay"}`}>{testMessage}</p>}
        </div>

        <div className="rounded-xl border border-line bg-ink p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Assign a buyer key</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Creates a license under your Keygen policy. Copy the key and send it with the Setup file.
          </p>
          <label className="mt-4 grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Buyer name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jordan Pearce"
              className="h-11 rounded-lg border border-line bg-panel px-3 text-paper outline-none focus:border-brass"
            />
          </label>
          <label className="mt-3 grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Buyer email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="buyer@company.com"
              className="h-11 rounded-lg border border-line bg-panel px-3 text-paper outline-none focus:border-brass"
            />
          </label>
          <button
            type="button"
            disabled={!canIssue || assigning}
            onClick={async () => {
              setAssigning(true)
              onError(null)
              try {
                const next = await assignLicense({ name, email })
                setLatest(next.license)
                onIssued(next.issued)
                setName("")
                setEmail("")
              } catch (err) {
                onError(err instanceof Error ? err.message : "Could not assign a license.")
              } finally {
                setAssigning(false)
              }
            }}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brass text-sm font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
          >
            {assigning && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {assigning ? "Creating key…" : canIssue ? "Create license key" : "Connect Keygen first"}
          </button>

          {latest && (
            <div className="mt-4 rounded-lg border border-brass/40 bg-panel px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">New key for {latest.name}</p>
              <p className="mt-2 break-all font-mono text-sm text-paper">{latest.key}</p>
              <button
                type="button"
                onClick={() => void copy(latest.key, latest.id)}
                className="mt-2 inline-flex items-center gap-1 text-sm text-brass hover:underline"
              >
                {copied === latest.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === latest.id ? "Copied" : "Copy key"}
              </button>
            </div>
          )}
        </div>
      </div>

      {issued.length > 0 && (
        <ul className="mt-6 grid gap-2">
          {issued.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-ink px-4 py-3">
              <div>
                <p className="text-sm text-paper">{row.name || "PlaceFind customer"}</p>
                <p className="text-xs text-muted">
                  {row.email || "No email"} · {new Date(row.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 break-all font-mono text-xs text-paper/80">{row.key}</p>
              </div>
              <button
                type="button"
                onClick={() => void copy(row.key, row.id)}
                className="inline-flex items-center gap-1 text-sm text-brass hover:underline"
              >
                {copied === row.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === row.id ? "Copied" : "Copy"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
