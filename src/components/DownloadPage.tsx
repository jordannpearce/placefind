import { Download, Monitor } from "lucide-react"
import { useEffect, useState } from "react"
import { formatBytes, loadStore } from "../lib/api.ts"
import type { InstallerFile, ProductInfo } from "../lib/types.ts"

export function DownloadPage() {
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [setup, setSetup] = useState<InstallerFile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadStore()
      .then((store) => {
        setProduct(store.product)
        setSetup(store.installer.files.find((file) => file.kind === "setup") ?? store.installer.files[0] ?? null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load downloads."))
  }, [])

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <section className="rounded-2xl border border-line bg-panel p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Windows download</p>
        <h2 className="mt-2 font-display text-4xl text-paper">{product?.name ?? "PlaceFind"}</h2>
        <p className="mt-3 text-sm leading-6 text-muted">{product?.pitch}</p>
        <p className="mt-4 font-display text-3xl text-brass">${product?.price ?? "49"}</p>
        <p className="mt-1 text-xs text-muted">
          One-time license for the Windows app. Search works as soon as they install it. Your API keys stay hidden.
        </p>

        {setup ? (
          <a
            href={setup.url}
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-lg bg-brass px-5 font-semibold text-ink hover:bg-[#ecc77a]"
          >
            <Download className="h-4 w-4" />
            Download Windows setup
          </a>
        ) : (
          <p className="mt-6 rounded-xl border border-line bg-ink px-4 py-3 text-sm text-muted">
            The setup file is not built yet. Open Sell and click Create Windows setup, then come back here.
          </p>
        )}
        {setup && (
          <p className="mt-3 text-xs text-muted">
            {setup.name} · {formatBytes(setup.size)}
          </p>
        )}
        {error && <p className="mt-4 text-sm text-clay">{error}</p>}
      </section>

      <section className="rounded-2xl border border-line bg-panel p-6">
        <p className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
          <Monitor className="h-3.5 w-3.5" />
          After download
        </p>
        <ol className="mt-4 grid gap-3 text-sm leading-6 text-paper/80">
          <li>1. Run the Setup file on Windows 10 or 11 (64-bit).</li>
          <li>2. Choose an install folder. A desktop shortcut is created for you.</li>
          <li>3. Open PlaceFind. If the seller included API keys, you can search right away.</li>
          <li>4. Search a business by name, city, and state.</li>
        </ol>
      </section>
    </div>
  )
}