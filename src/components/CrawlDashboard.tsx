import { LoaderCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { loadAccount, loadCrawl, loadCrawls, requestWebsiteCrawl } from "../lib/api.ts"
import { listingLocation, listingPath } from "../lib/listings.ts"
import type { AccountUsage, AuthUser, CrawlJob, DirectoryListing } from "../lib/types.ts"
import { OwnerDeskTools } from "./OwnerDeskTools.tsx"
import { UsageCard } from "./UsageCard.tsx"

type Props = {
  user: AuthUser
  onGo: (path: string) => void
}

function statusLabel(status: CrawlJob["status"] | DirectoryListing["crawlStatus"]) {
  if (status === "ok") return "Article written"
  if (status === "running" || status === "queued") return "Crawling website…"
  if (status === "error") return "Crawl could not finish"
  return "Ready to crawl"
}

export function CrawlDashboard({ user, onGo }: Props) {
  const [listings, setListings] = useState<DirectoryListing[]>([])
  const [crawls, setCrawls] = useState<CrawlJob[]>([])
  const [listingId, setListingId] = useState("")
  const [website, setWebsite] = useState("")
  const [active, setActive] = useState<CrawlJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [usage, setUsage] = useState<AccountUsage | null>(null)
  const [usageError, setUsageError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  async function refresh() {
    const [account, jobs] = await Promise.all([loadAccount(), loadCrawls()])
    const rows = account.listings ?? []
    setListings(rows)
    setCrawls(jobs)
    setListingId((current) => current || rows[0]?.id || "")
    if (!website && rows[0]?.website) setWebsite(rows[0].website)
    if (account.usage) {
      setUsage(account.usage)
      setUsageError(null)
    } else {
      setUsage(null)
      setUsageError("Monthly usage is not available yet.")
    }
  }

  useEffect(() => {
    void refresh()
      .catch((err) => {
        const message = err instanceof Error ? err.message : "Could not load the crawl desk."
        setError(message)
        setUsageError(message)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const selected = listings.find((row) => row.id === listingId)
    if (selected?.website) setWebsite(selected.website)
  }, [listingId, listings])

  useEffect(() => {
    if (!active || (active.status !== "queued" && active.status !== "running")) return
    const timer = window.setInterval(() => {
      void loadCrawl(active.id)
        .then((job) => {
          setActive(job)
          setCrawls((rows) => [job, ...rows.filter((row) => row.id !== job.id)])
        })
        .catch(() => undefined)
    }, 2500)
    return () => window.clearInterval(timer)
  }, [active])

  async function startCrawl() {
    if (!listingId) {
      setError("Create a listing first, then request a crawl.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      const job = await requestWebsiteCrawl({ listingId, website })
      setActive(job)
      setCrawls((rows) => [job, ...rows.filter((row) => row.id !== job.id)])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start that crawl.")
    } finally {
      setBusy(false)
    }
  }

  const selected = listings.find((row) => row.id === listingId)

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      <section className="rounded-2xl border border-line bg-panel p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Dashboard</p>
        <h2 className="mt-2 font-display text-3xl text-paper">Your business desk</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          This desk is separate from the public directory. Open Rank tracker or Traffic for a signed-in scan, or crawl
          the listing website to write a public profile article. Crawl Website does not change the listing form — name,
          address, phone, website, hours, category, keywords, and Maps details stay as you entered them.
        </p>
        <p className="mt-2 text-sm text-muted">Signed in as {user.email}.</p>
        <div className="mt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Owner tools</p>
          <div className="mt-3">
            <OwnerDeskTools onGo={onGo} />
          </div>
        </div>
        {error && <p className="mt-4 rounded-xl border border-clay/40 bg-clay/10 px-4 py-3 text-sm text-clay">{error}</p>}
        <h3 className="mt-8 font-display text-2xl text-paper">Crawl Website</h3>
        {loading ? (
          <p className="mt-6 text-sm text-muted">Loading your listings…</p>
        ) : listings.length === 0 ? (
          <div className="mt-6">
            <p className="text-sm text-muted">You need a listing before you can request a crawl.</p>
            <button
              type="button"
              onClick={() => onGo("/listings/new")}
              className="mt-4 h-11 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a]"
            >
              Create a listing
            </button>
          </div>
        ) : (
          <form
            className="mt-6 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void startCrawl()
            }}
          >
            <label className="grid gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Listing</span>
              <select
                value={listingId}
                onChange={(event) => setListingId(event.target.value)}
                className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
              >
                {listings.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name} · {listingLocation(row)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Website</span>
              <input
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder="https://yourshop.com"
                className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              data-testid="crawl-website"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-brass px-5 font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              Crawl Website
            </button>
            {selected && (
              <p className="text-sm text-muted">
                {statusLabel(active?.status || selected.crawlStatus)}{" "}
                {selected.lastCrawledAt ? `· last run ${new Date(selected.lastCrawledAt).toLocaleDateString()}` : ""}
              </p>
            )}
          </form>
        )}
      </section>

      <UsageCard usage={usage} error={usageError} loading={loading} />

      {active && (
        <section className="rounded-2xl border border-line bg-panel p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">This crawl</p>
          <h3 className="mt-2 font-display text-2xl text-paper">{statusLabel(active.status)}</h3>
          <p className="mt-2 text-sm text-muted">
            {active.websiteUrl}
            {active.sitemapFound ? " · sitemap found" : ""}
            {active.pagesCrawled ? ` · ${active.pagesCrawled} pages read` : ""}
          </p>
          {active.error && <p className="mt-3 text-sm text-clay">{active.error}</p>}
          {(active.brand || active.licenseInfo || active.yearsInBusiness || active.specialty) && (
            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Found on this crawl</p>
              <p className="mt-1 text-xs text-muted">
                Read-only crawl results. These facts are used to write the article. They are not saved over the listing
                form.
              </p>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
                {active.brand && (
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">Brand found</dt>
                    <dd className="mt-1 text-paper">{active.brand}</dd>
                  </div>
                )}
                {active.licenseInfo && (
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">License found</dt>
                    <dd className="mt-1 text-paper">{active.licenseInfo}</dd>
                  </div>
                )}
                {active.yearsInBusiness && (
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">How long in business</dt>
                    <dd className="mt-1 text-paper">{active.yearsInBusiness}</dd>
                  </div>
                )}
                {active.specialty && (
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.16em] text-muted">Specializes in</dt>
                    <dd className="mt-1 text-paper">{active.specialty}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
          {active.article && (
            <div className="mt-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Profile article</p>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-paper/90">{active.article}</div>
            </div>
          )}
          <button
            type="button"
            onClick={() => onGo(listingPath(listings.find((row) => row.id === active.listingId) ?? active.listingId))}
            className="mt-5 text-sm text-brass hover:underline"
          >
            Open the public profile
          </button>
        </section>
      )}

      {active && (active.pages?.length ?? 0) > 0 && (
        <section className="rounded-2xl border border-line bg-panel p-6" data-testid="crawl-pages">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Pages crawled</p>
          <h3 className="mt-2 font-display text-2xl text-paper">
            {active.pages?.length} page{(active.pages?.length ?? 0) === 1 ? "" : "s"} from this website
          </h3>
          <p className="mt-2 text-sm text-muted">
            Every page PlaceFind opened is listed here — URL, whether it loaded, the title or snippet, and any facts
            pulled from that page. This is a crawl log, not a list of listing-form edits.
          </p>
          <ul className="mt-5 grid gap-3">
            {active.pages?.map((page) => (
              <li key={page.url} className="rounded-xl border border-line bg-ink px-4 py-3">
                <p className="break-all text-sm text-paper">{page.url}</p>
                <p className="mt-1 text-xs text-muted">
                  {page.status === "ok" ? "Opened" : "Could not open"}
                  {page.title ? ` · ${page.title}` : ""}
                </p>
                {page.snippet && <p className="mt-2 text-sm leading-6 text-paper/80">{page.snippet}</p>}
                {(page.brand || page.licenseInfo || page.yearsInBusiness || page.specialty) && (
                  <p className="mt-2 text-xs text-muted">
                    {[
                      page.brand && `Brand: ${page.brand}`,
                      page.licenseInfo,
                      page.yearsInBusiness,
                      page.specialty && `Specializes in ${page.specialty}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {page.error && <p className="mt-2 text-sm text-clay">{page.error}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {crawls.length > 0 && (
        <section className="rounded-2xl border border-line bg-panel p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Recent crawl requests</p>
          <ul className="mt-4 grid gap-3">
            {crawls.slice(0, 8).map((job) => (
              <li key={job.id}>
                <button
                  type="button"
                  onClick={() => setActive(job)}
                  className="w-full rounded-xl border border-line bg-ink px-4 py-3 text-left hover:border-brass/60"
                >
                  <p className="text-sm text-paper">{job.websiteUrl}</p>
                  <p className="mt-1 text-xs text-muted">
                    {statusLabel(job.status)} · {new Date(job.createdAt).toLocaleString()}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
