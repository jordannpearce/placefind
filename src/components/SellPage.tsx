import { Download, Folder, LoaderCircle, Package } from "lucide-react"
import { useEffect, useState } from "react"
import { formatBytes, loadInstaller, loadStore, saveHostedKeys, saveProduct, startInstallerBuild } from "../lib/api.ts"
import type { HostedKeyStatus, InstallerStatus, ProductInfo } from "../lib/types.ts"

function statusCopy(status: InstallerStatus["status"]) {
  if (status === "running") return "Updating the Windows setup file. This can take a few minutes."
  if (status === "ok") return "The Windows setup file is ready. Download it or copy it from the folder below."
  if (status === "error") return "The last build did not finish. Check the log, then try again."
  return "Create a Setup.exe that customers install on Windows."
}

export function SellPage() {
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [installer, setInstaller] = useState<InstallerStatus | null>(null)
  const [hosted, setHosted] = useState<HostedKeyStatus | null>(null)
  const [price, setPrice] = useState("49")
  const [pitch, setPitch] = useState("")
  const [scrappeyKey, setScrappeyKey] = useState("")
  const [dataforseoLogin, setDataforseoLogin] = useState("")
  const [dataforseoPassword, setDataforseoPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [savingKeys, setSavingKeys] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    const store = await loadStore()
    setProduct(store.product)
    setInstaller(store.installer)
    setHosted(store.hosted)
    setPrice(store.product.price)
    setPitch(store.product.pitch)
  }

  useEffect(() => {
    void refresh().catch((err) => setError(err instanceof Error ? err.message : "Could not load sell page."))
  }, [])

  useEffect(() => {
    if (installer?.status !== "running") return
    const timer = window.setInterval(() => {
      void loadInstaller().then(setInstaller)
    }, 2500)
    return () => window.clearInterval(timer)
  }, [installer?.status])

  const setup = installer?.files.find((file) => file.kind === "setup") ?? installer?.files[0]
  const keysReady = Boolean(hosted?.scrappey || hosted?.dataforseo)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="rounded-2xl border border-line bg-panel p-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Sell PlaceFind</p>
        <h2 className="mt-1 font-display text-3xl text-paper">Create the Windows setup</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">{statusCopy(installer?.status ?? "idle")}</p>

        <div className="mt-5 rounded-xl border border-line bg-ink px-4 py-3">
          <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            <Folder className="h-3.5 w-3.5" />
            Setup folder on this computer
          </p>
          <p className="mt-2 break-all font-mono text-sm text-paper">{installer?.setupPath || "/workspace/release/PlaceFind-Setup-1.0.0.exe"}</p>
          <p className="mt-1 text-xs text-muted">Folder: {installer?.folder || "/workspace/release"}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={installer?.status === "running"}
            onClick={async () => {
              setError(null)
              try {
                setInstaller(await startInstallerBuild())
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not start the build.")
              }
            }}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a] disabled:cursor-wait disabled:opacity-70"
          >
            {installer?.status === "running" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
            {installer?.status === "running" ? "Creating setup…" : "Create Windows setup"}
          </button>
          {setup && (
            <a
              href={setup.url}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-brass px-4 text-sm font-semibold text-brass hover:bg-brass/10"
            >
              <Download className="h-4 w-4" />
              Download {setup.name}
            </a>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-clay">{error}</p>}
        {installer?.error && <p className="mt-4 text-sm text-clay">{installer.error}</p>}

        {installer?.files.length ? (
          <ul className="mt-6 grid gap-2">
            {installer.files.map((file) => (
              <li key={file.name} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink px-4 py-3">
                <div>
                  <p className="text-sm text-paper">{file.name}</p>
                  <p className="text-xs capitalize text-muted">
                    {file.kind === "setup" ? "Windows installer" : file.kind === "portable" ? "Portable app" : "File"} · {formatBytes(file.size)}
                  </p>
                </div>
                <a href={file.url} className="text-sm text-brass hover:underline">
                  Download
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-muted">No setup file yet. Click Create Windows setup.</p>
        )}

        {installer?.log && (
          <pre className="mt-6 max-h-56 overflow-auto rounded-xl border border-line bg-ink p-4 text-[11px] leading-5 text-muted">
            {installer.log}
          </pre>
        )}
      </section>

      <aside className="grid gap-6">
        <section className="rounded-2xl border border-line bg-panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Keys in the installer</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Paste your keys here. They are encrypted into the Setup file. Buyers search with your keys and never see the values. Your DataForSEO and Scrappey accounts pay for those searches.
          </p>
          {keysReady && (
            <p className="mt-3 text-sm text-moss">
              Included{hosted?.dataforseo ? ` · DataForSEO ${hosted.dataforseoHint}` : ""}
              {hosted?.scrappey ? ` · Scrappey ${hosted.scrappeyHint}` : ""}
            </p>
          )}
          <label className="mt-4 grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Scrappey API key</span>
            <input
              type="password"
              value={scrappeyKey}
              onChange={(event) => setScrappeyKey(event.target.value)}
              placeholder={hosted?.scrappeyHint || "scp_…"}
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            />
          </label>
          <label className="mt-3 grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">DataForSEO login</span>
            <input
              value={dataforseoLogin}
              onChange={(event) => setDataforseoLogin(event.target.value)}
              placeholder={hosted?.dataforseoHint || "you@company.com"}
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            />
          </label>
          <label className="mt-3 grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">DataForSEO API password</span>
            <input
              type="password"
              value={dataforseoPassword}
              onChange={(event) => setDataforseoPassword(event.target.value)}
              placeholder="API password"
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            />
          </label>
          <button
            type="button"
            disabled={savingKeys || installer?.status === "running"}
            onClick={async () => {
              setSavingKeys(true)
              setError(null)
              try {
                const next = await saveHostedKeys({ scrappeyKey, dataforseoLogin, dataforseoPassword })
                setHosted(next.hosted)
                setInstaller(next.installer)
                setScrappeyKey("")
                setDataforseoLogin("")
                setDataforseoPassword("")
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not save keys.")
              } finally {
                setSavingKeys(false)
              }
            }}
            className="mt-4 h-11 w-full rounded-lg bg-brass text-sm font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
          >
            {savingKeys || installer?.status === "running" ? "Putting keys in the setup…" : "Save keys into the setup"}
          </button>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Customer page</p>
          <label className="mt-4 grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Price (USD)</span>
            <input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            />
          </label>
          <label className="mt-3 grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Short pitch</span>
            <textarea
              value={pitch}
              onChange={(event) => setPitch(event.target.value)}
              rows={4}
              className="rounded-lg border border-line bg-ink px-3 py-2 text-paper outline-none focus:border-brass"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true)
              setError(null)
              try {
                setProduct(await saveProduct({ price, pitch }))
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not save.")
              } finally {
                setSaving(false)
              }
            }}
            className="mt-4 h-11 w-full rounded-lg border border-line text-sm font-semibold text-paper hover:border-brass"
          >
            {saving ? "Saving…" : "Save listing"}
          </button>
          {product && (
            <p className="mt-4 text-xs text-muted">
              {product.name} v{product.version} · ${product.price}
            </p>
          )}
        </section>
      </aside>
    </div>
  )
}
