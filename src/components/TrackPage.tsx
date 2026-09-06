import { LoaderCircle, Plus, Star, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  createCampaign,
  deleteCampaign,
  loadCampaignGrid,
  loadCampaigns,
  scanCampaign,
  searchBusiness,
  startCampaignTraffic,
  updateCampaign,
} from "../lib/api.ts"
import { buildPreviewPoints, pinColor, rankColor, rankLabel } from "../lib/grid.ts"
import { publicSearchMessage } from "../lib/public-copy.ts"
import { US_STATES } from "../lib/states.ts"
import {
  campaignInputFromListing,
  confirmedListingFromCampaign,
  confirmedListingFromSearch,
  listingsFromSearch,
  campaignScanFinished,
  scanBusinessEnabled,
  searchChanged,
  searchQueryFromCampaign,
  startTrafficEnabled,
  startTrafficLabel,
  startTrafficVisible,
} from "../lib/track.ts"
import type {
  ApiKeys,
  BusinessListing,
  Campaign,
  ConfirmedListing,
  GeoPoint,
  GridPointResult,
  HostedKeyStatus,
  SearchQuery,
  SearchResponse,
} from "../lib/types.ts"
import { GridMap } from "./GridMap.tsx"

type Props = {
  keys: ApiKeys
  hosted: HostedKeyStatus | null
  seller: boolean
  desktop?: boolean
}

const emptyQuery = (): SearchQuery => ({ name: "", city: "", state: "" })

function formatWhen(value: string | null | undefined): string {
  if (!value) return "Not scanned yet"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not scanned yet"
  return date.toLocaleString()
}

function searchCount(gridSize: number) {
  return gridSize * gridSize
}

export function TrackPage({ keys, hosted, seller, desktop }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [maxKeywords, setMaxKeywords] = useState(20)
  const [allowedGridSizes, setAllowedGridSizes] = useState([3, 5, 7])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState<SearchQuery>(emptyQuery)
  const [keywordDraft, setKeywordDraft] = useState("")
  const [activeKeyword, setActiveKeyword] = useState("")
  const [gridSize, setGridSize] = useState(5)
  const [spacingMiles, setSpacingMiles] = useState(1)
  const [creating, setCreating] = useState(true)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [startingTraffic, setStartingTraffic] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null)
  const [confirmed, setConfirmed] = useState<ConfirmedListing | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<GridPointResult | null>(null)
  const [previewCenter, setPreviewCenter] = useState<GeoPoint | null>(null)

  const selected = useMemo(
    () => (campaigns ?? []).find((campaign) => campaign.id === selectedId) ?? null,
    [campaigns, selectedId],
  )

  const listings = listingsFromSearch(searchResult)
  const canScan = scanBusinessEnabled(confirmed)
  const grid = selected?.lastGridScan ?? null
  const mapCenter = confirmed
    ? { lat: confirmed.lat, lng: confirmed.lng }
    : selected?.center || grid?.center || previewCenter
  const points = useMemo(() => {
    const keyword = activeKeyword || selected?.keywords[0] || keywordDraft.trim() || ""
    const scanMatches =
      Boolean(grid) &&
      grid!.gridSize === gridSize &&
      Math.abs(grid!.spacingMiles - spacingMiles) < 1e-6 &&
      Boolean(mapCenter) &&
      Math.abs(grid!.center.lat - mapCenter!.lat) < 1e-6 &&
      Math.abs(grid!.center.lng - mapCenter!.lng) < 1e-6
    if (scanMatches && grid) {
      if (!activeKeyword) return grid.points
      return grid.points.filter((point) => point.keyword.toLowerCase() === activeKeyword.toLowerCase())
    }
    if (!mapCenter || !confirmed) return []
    return buildPreviewPoints(mapCenter, gridSize, spacingMiles, keyword)
  }, [grid, activeKeyword, gridSize, spacingMiles, mapCenter, selected?.keywords, keywordDraft, confirmed])

  function applyCampaign(campaign: Campaign | null) {
    if (!campaign) {
      setQuery(emptyQuery())
      setConfirmed(null)
      setActiveKeyword("")
      setKeywordDraft("")
      setGridSize(5)
      setSpacingMiles(1)
      setPreviewCenter(null)
      return
    }
    setQuery(searchQueryFromCampaign(campaign))
    setConfirmed(confirmedListingFromCampaign(campaign))
    setActiveKeyword(campaign.lastGridScan?.keyword || campaign.keywords[0] || "")
    setKeywordDraft("")
    setGridSize(campaign.gridSize ?? 5)
    setSpacingMiles(campaign.spacingMiles ?? 1)
    setPreviewCenter(campaign.center || campaign.lastGridScan?.center || null)
  }

  async function refresh(nextId?: string | null) {
    const payload = await loadCampaigns()
    const rows = payload.campaigns ?? []
    setCampaigns(rows)
    setMaxKeywords(payload.maxKeywords)
    setAllowedGridSizes(payload.allowedGridSizes)
    const keep = nextId !== undefined ? nextId : selectedId
    const next = rows.find((campaign) => campaign.id === keep) ?? rows[0] ?? null
    setSelectedId(next?.id ?? null)
    setCreating(!next)
    applyCampaign(next)
    setSelectedPoint(null)
    return payload.campaigns
  }

  useEffect(() => {
    let active = true
    void loadCampaigns()
      .then((payload) => {
        if (!active) return
        setCampaigns(payload.campaigns ?? [])
        setMaxKeywords(payload.maxKeywords)
        setAllowedGridSizes(payload.allowedGridSizes)
        const next = payload.campaigns[0] ?? null
        setSelectedId(next?.id ?? null)
        setCreating(!next)
        applyCampaign(next)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load campaigns.")
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!selected || creating || confirmed || selected.center || selected.lastGridScan?.center) return
    let active = true
    void loadCampaignGrid(selected.id, { gridSize, spacingMiles })
      .then((payload) => {
        if (!active) return
        replaceCampaign(payload.campaign)
        setPreviewCenter(payload.center)
      })
      .catch(() => {
        // Preview waits until a listing is confirmed.
      })
    return () => {
      active = false
    }
  }, [selected?.id, selected?.center, creating, confirmed, gridSize, spacingMiles])

  useEffect(() => {
    if (!selectedPoint) return
    const next = points.find((point) => point.row === selectedPoint.row && point.col === selectedPoint.col)
    if (!next) setSelectedPoint(null)
    else if (next !== selectedPoint) setSelectedPoint(next)
  }, [points, selectedPoint])

  function replaceCampaign(next: Campaign) {
    setCampaigns((current) => current.map((row) => (row.id === next.id ? next : row)))
    if (selectedId === next.id) {
      setGridSize(next.gridSize ?? 5)
      setSpacingMiles(next.spacingMiles ?? 1)
      if (next.lastGridScan?.keyword) setActiveKeyword(next.lastGridScan.keyword)
      const listing = confirmedListingFromCampaign(next)
      if (listing) setConfirmed(listing)
    }
  }

  function onQueryChange(next: SearchQuery) {
    if (searchChanged(query, next)) {
      setConfirmed(null)
      setSearchResult(null)
      setPreviewCenter(null)
      setSelectedPoint(null)
      setNotice(null)
    }
    setQuery(next)
  }

  async function onSearch() {
    setSearching(true)
    setError(null)
    setNotice(null)
    setConfirmed(null)
    setSelectedPoint(null)
    try {
      const payload = await searchBusiness(query, keys, Boolean(hosted?.included && !seller))
      setSearchResult(payload)
      if (payload.error && !payload.best && payload.others.length === 0) {
        setError(publicSearchMessage(payload.error) || payload.error)
      }
    } catch (err) {
      setSearchResult(null)
      setError(err instanceof Error ? err.message : "Could not search Maps.")
    } finally {
      setSearching(false)
    }
  }

  async function confirmListing(listing: BusinessListing) {
    const next = confirmedListingFromSearch(listing)
    if (!next) {
      setError("That listing is missing a map location. Choose another one.")
      return
    }
    setConfirmed(next)
    setPreviewCenter({ lat: next.lat, lng: next.lng })
    setError(null)
    setNotice(`Confirmed ${next.title}. Set a keyword and grid, then scan.`)
    if (!selected || creating) return
    setSaving(true)
    try {
      replaceCampaign(
        await updateCampaign(
          selected.id,
          campaignInputFromListing(next, query, {
            keywords: selected.keywords,
            gridSize,
            spacingMiles,
          }),
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the confirmed listing.")
    } finally {
      setSaving(false)
    }
  }

  async function persistGrid(nextSize: number, nextSpacing: number) {
    setGridSize(nextSize)
    setSpacingMiles(nextSpacing)
    if (!selected || creating) return
    void updateCampaign(selected.id, { gridSize: nextSize, spacingMiles: nextSpacing })
      .then(replaceCampaign)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not save the grid."))
  }

  async function onAddKeyword() {
    if (!selected) return
    const keyword = keywordDraft.trim()
    if (!keyword) return
    if (selected.keywords.length >= maxKeywords) {
      setError(`A campaign can have at most ${maxKeywords} keywords.`)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const next = await updateCampaign(selected.id, { keywords: [...selected.keywords, keyword] })
      replaceCampaign(next)
      setKeywordDraft("")
      if (!activeKeyword) setActiveKeyword(keyword)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add that keyword.")
    } finally {
      setSaving(false)
    }
  }

  async function onRemoveKeyword(keyword: string) {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const next = await updateCampaign(selected.id, { keywords: selected.keywords.filter((row) => row !== keyword) })
      replaceCampaign(next)
      if (activeKeyword.toLowerCase() === keyword.toLowerCase()) setActiveKeyword(next.keywords[0] || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that keyword.")
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!selected) return
    if (!window.confirm(`Delete “${selected.name}”? This removes the campaign and its grid scans.`)) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await deleteCampaign(selected.id)
      setSearchResult(null)
      await refresh(null)
      setCreating(true)
      setNotice("Campaign deleted.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the campaign.")
    } finally {
      setSaving(false)
    }
  }

  async function onScan() {
    if (!canScan || !confirmed) {
      setError("Confirm a Maps listing before scanning.")
      return
    }
    const target = (activeKeyword || keywordDraft || selected?.keywords[0] || "").trim()
    if (!target) {
      setError("Add a keyword before scanning this business.")
      return
    }
    setScanning(true)
    setError(null)
    setNotice(null)
    setSelectedPoint(null)
    try {
      const hideKeys = Boolean(hosted?.included && !seller)
      let campaign = selected
      if (!campaign || creating) {
        campaign = await createCampaign(
          campaignInputFromListing(confirmed, query, {
            keywords: [target],
            gridSize,
            spacingMiles,
          }),
        )
        setCreating(false)
        setSelectedId(campaign.id)
        setCampaigns((current) => [campaign!, ...current.filter((row) => row.id !== campaign!.id)])
      } else {
        const keywords = campaign.keywords.some((row) => row.toLowerCase() === target.toLowerCase())
          ? campaign.keywords
          : [...campaign.keywords, target]
        campaign = await updateCampaign(
          campaign.id,
          campaignInputFromListing(confirmed, query, { keywords, gridSize, spacingMiles }),
        )
        replaceCampaign(campaign)
      }
      const payload = await scanCampaign(campaign.id, keys, hideKeys, [target])
      replaceCampaign(payload.campaign)
      setActiveKeyword(payload.grid?.keyword || target)
      setKeywordDraft("")
      const found = payload.grid?.foundCount ?? 0
      const total = payload.grid?.pointCount ?? 0
      setNotice(`Scan finished. ${confirmed.title} appeared at ${found} of ${total} grid points for “${target}”.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not scan Maps.")
    } finally {
      setScanning(false)
    }
  }

  function startCreate() {
    setCreating(true)
    setSelectedId(null)
    applyCampaign(null)
    setSearchResult(null)
    setSelectedPoint(null)
    setError(null)
    setNotice(null)
  }

  function selectCampaign(campaign: Campaign) {
    setCreating(false)
    setSelectedId(campaign.id)
    applyCampaign(campaign)
    setSearchResult(null)
    setSelectedPoint(null)
    setError(null)
    setNotice(null)
  }

  const mapsReady = Boolean((keys.dataforseoLogin && keys.dataforseoPassword) || hosted?.dataforseo)
  const busy = Boolean(saving || scanning || searching || startingTraffic)
  const scanFinished = campaignScanFinished(selected)
  const showStartTraffic = startTrafficVisible(confirmed)
  const canStartTraffic = startTrafficEnabled({
    listing: confirmed,
    campaign: selected,
    scanning,
    starting: startingTraffic,
    busy,
  })
  const trafficLabel = startTrafficLabel({ scanning, starting: startingTraffic, scanFinished })
  const step = searching ? 1 : confirmed ? 3 : listings.length > 0 ? 2 : 1

  async function onStartTraffic() {
    if (!selected) return
    const sessions = 3
    const requests = sessions * 2
    const ok = window.confirm(
      `Start ${sessions} traffic sessions for ${confirmed?.title || selected.businessName}?\n\nThis uses your Maps traffic runner to search Maps and open the listing profile.\n\nEstimated ${requests} Maps requests (2 per session).`,
    )
    if (!ok) return
    setStartingTraffic(true)
    setError(null)
    setNotice(null)
    try {
      const payload = await startCampaignTraffic(selected.id, keys, Boolean(hosted?.included && !seller), sessions)
      replaceCampaign(payload.campaign)
      const job = payload.traffic
      setNotice(`Traffic finished. ${job.sessionsOk} of ${job.sessionsAttempted} sessions opened the listing.`)
      if (job.lastError && job.sessionsOk === 0) setError(job.lastError)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start traffic.")
    } finally {
      setStartingTraffic(false)
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-line bg-panel p-8">
        <p className="font-display text-2xl text-paper">Loading tracker</p>
        <p className="mt-2 text-sm text-muted">Reading saved grid campaigns.</p>
      </section>
    )
  }

  return (
    <div className="grid flex-1 gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-line bg-panel p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Campaigns</p>
            <h2 className="font-display text-2xl text-paper">Grid tracker</h2>
          </div>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-brass px-3 text-sm font-semibold text-ink hover:bg-[#ecc77a]"
          >
            <Plus className="h-4 w-4" />
            New
          </button>
        </div>
        <p className="mb-4 text-sm leading-6 text-muted">
          Search for the business, click the right Maps listing, then scan ranks around it.
        </p>
        {campaigns.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-sm text-muted">
            No campaigns yet. Search a business, confirm the listing, then scan.
          </p>
        ) : (
          <ul className="grid gap-1">
            {campaigns.map((campaign) => {
              const active = !creating && campaign.id === selectedId
              return (
                <li key={campaign.id}>
                  <button
                    type="button"
                    onClick={() => selectCampaign(campaign)}
                    className={`w-full rounded-lg px-3 py-2.5 text-left ${active ? "bg-raised text-brass" : "text-paper/80 hover:bg-raised"}`}
                  >
                    <span className="block truncate text-sm">{campaign.listingTitle || campaign.name}</span>
                    <span className="block text-xs text-muted">
                      {campaign.listingAddress || `${campaign.city}, ${campaign.state}`}
                    </span>
                    <span className="block text-xs text-muted">
                      {campaign.gridSize ?? 5}×{campaign.gridSize ?? 5}
                      {campaign.lastGridScan
                        ? ` · ${campaign.lastGridScan.foundCount}/${campaign.lastGridScan.pointCount} found`
                        : " · not scanned"}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      <main className="grid min-w-0 gap-4">
        {error && <p className="rounded-xl border border-clay/40 bg-panel px-4 py-3 text-sm text-clay">{error}</p>}
        {notice && <p className="rounded-xl border border-brass/30 bg-brass/10 px-4 py-3 text-sm text-brass">{notice}</p>}

        <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Track a business</p>
              <h3 className="font-display text-3xl text-paper">
                {confirmed ? confirmed.title : selected && !creating ? selected.name : "Search, confirm, then scan"}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {confirmed
                  ? confirmed.address
                  : "Find the listing first. Do not scan until you have clicked the correct business."}
              </p>
            </div>
            {selected && !creating && (
              <button
                type="button"
                onClick={() => void onDelete()}
                disabled={busy}
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm text-paper/80 hover:border-clay hover:text-clay disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}
          </div>

          <ol className="mt-5 grid gap-2 sm:grid-cols-3">
            {[
              { n: 1, label: "Search", detail: "Name, city, and state" },
              { n: 2, label: "Confirm", detail: "Click the right listing" },
              { n: 3, label: "Scan business", detail: "Keyword and grid" },
            ].map((row) => (
              <li
                key={row.n}
                className={`rounded-xl border px-3 py-2.5 ${step === row.n ? "border-brass bg-brass/10 text-brass" : "border-line text-muted"}`}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">
                  {row.n}. {row.label}
                </p>
                <p className="mt-1 text-xs text-paper/70">{row.detail}</p>
              </li>
            ))}
          </ol>

          <form
            className="mt-6 grid gap-4"
            onSubmit={(event: FormEvent) => {
              event.preventDefault()
              void onSearch()
            }}
          >
            <label className="grid gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Business name</span>
              <input
                value={query.name}
                onChange={(event) => onQueryChange({ ...query, name: event.target.value })}
                placeholder="Franklin Barbecue"
                autoComplete="off"
                className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none placeholder:text-muted/50 focus:border-brass"
              />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7.5rem]">
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">City</span>
                <input
                  value={query.city}
                  onChange={(event) => onQueryChange({ ...query, city: event.target.value })}
                  placeholder="Austin"
                  autoComplete="off"
                  className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none placeholder:text-muted/50 focus:border-brass"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">State</span>
                <select
                  value={query.state}
                  onChange={(event) => onQueryChange({ ...query, state: event.target.value })}
                  className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
                >
                  <option value="">Select</option>
                  {US_STATES.map((state) => (
                    <option key={state.abbr} value={state.abbr}>
                      {state.abbr}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="submit"
              disabled={searching}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line text-sm font-semibold text-paper hover:border-brass disabled:opacity-60"
            >
              {searching && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {searching ? "Searching Maps…" : "Find listing"}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Matches</p>
          <h4 className="font-display text-2xl text-paper">Click the correct listing</h4>
          <ListingResults
            searching={searching}
            result={searchResult}
            listings={listings}
            confirmed={confirmed}
            onConfirm={(listing) => void confirmListing(listing)}
          />
        </section>

        {canScan && confirmed && (
          <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Confirmed listing</p>
                <h4 className="font-display text-2xl text-paper">{confirmed.title}</h4>
                <p className="mt-1 text-sm text-muted">{confirmed.address}</p>
                {confirmed.rating != null && (
                  <p className="mt-2 inline-flex items-center gap-1 text-sm text-brass">
                    <Star className="h-4 w-4 fill-current" />
                    {confirmed.rating.toFixed(1)}
                    {confirmed.reviewCount != null && (
                      <span className="text-muted">({confirmed.reviewCount.toLocaleString()})</span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void onScan()}
                  disabled={busy || !canScan}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
                >
                  {scanning && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {scanning ? "Scanning the grid…" : "Scan business"}
                </button>
                {showStartTraffic && (
                  <button
                    type="button"
                    data-testid="start-traffic"
                    onClick={() => void onStartTraffic()}
                    disabled={!canStartTraffic}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-brass bg-brass/10 px-4 font-semibold text-brass hover:bg-brass/20 disabled:opacity-60"
                  >
                    {(scanning || startingTraffic) && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    {trafficLabel}
                  </button>
                )}
              </div>
            </div>

            {!mapsReady && (
              <p className="mt-4 rounded-xl border border-clay/40 px-4 py-3 text-sm text-clay">
                Maps rank tracking is not ready on this copy yet.
              </p>
            )}
            {mapsReady && (
              <p className="mt-4 rounded-xl border border-brass/25 bg-brass/5 px-4 py-3 text-sm text-paper/80">
                A {gridSize}×{gridSize} scan runs {searchCount(gridSize)} paid Maps searches — one for each grid point,
                from that point’s coordinates. A 7×7 scan is 49 paid searches.
                {desktop ? " Larger grids take a few minutes." : ""}
              </p>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1.5 sm:col-span-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Keyword</span>
                <input
                  value={activeKeyword}
                  onChange={(event) => setActiveKeyword(event.target.value)}
                  placeholder="barbecue"
                  autoComplete="off"
                  className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none placeholder:text-muted/50 focus:border-brass"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Grid size</span>
                <select
                  value={gridSize}
                  onChange={(event) => void persistGrid(Number(event.target.value), spacingMiles)}
                  className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
                >
                  {allowedGridSizes.map((size) => (
                    <option key={size} value={size}>
                      {size}×{size} · {size * size} searches
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Miles between points</span>
                <input
                  type="number"
                  min={0.25}
                  max={10}
                  step={0.25}
                  value={spacingMiles}
                  onChange={(event) => void persistGrid(gridSize, Number(event.target.value))}
                  className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
                />
              </label>
            </div>

            {selected && !creating && (
              <form
                className="mt-4 flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault()
                  void onAddKeyword()
                }}
              >
                <input
                  value={keywordDraft}
                  onChange={(event) => setKeywordDraft(event.target.value)}
                  placeholder="Add another keyword"
                  autoComplete="off"
                  disabled={busy || selected.keywords.length >= maxKeywords}
                  className="h-11 flex-1 rounded-lg border border-line bg-ink px-3 text-paper outline-none placeholder:text-muted/50 focus:border-brass"
                />
                <button
                  type="submit"
                  disabled={busy || !keywordDraft.trim() || selected.keywords.length >= maxKeywords}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line px-4 text-sm text-paper/80 hover:border-brass disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Add keyword
                </button>
              </form>
            )}
            {selected && selected.keywords.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {selected.keywords.map((keyword) => {
                  const active = keyword.toLowerCase() === activeKeyword.toLowerCase()
                  return (
                    <button
                      key={keyword}
                      type="button"
                      onClick={() => setActiveKeyword(keyword)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${active ? "border-brass bg-brass/10 text-brass" : "border-line bg-ink text-paper"}`}
                    >
                      {keyword}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(event) => {
                          event.stopPropagation()
                          void onRemoveKeyword(keyword)
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            event.stopPropagation()
                            void onRemoveKeyword(keyword)
                          }
                        }}
                        className="text-muted hover:text-clay"
                        aria-label={`Remove ${keyword}`}
                      >
                        ×
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )}

        <section className="overflow-hidden rounded-2xl border border-line bg-panel p-0 sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-5 pt-5 sm:px-0 sm:pt-0">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Map grid</p>
              <h4 className="font-display text-2xl text-paper">Where the listing ranks</h4>
              <p className="mt-1 text-sm text-muted">
                {confirmed
                  ? `Pins mark every ${gridSize}×${gridSize} search point around ${confirmed.title}. Rank 1 is the darkest green, then 2 and 3 in lighter greens; 4–6 yellow, 7–10 orange, 11–15 orange-red, and 16+ or not found in red.`
                  : "Confirm a listing to drop a pin and center the grid on that business."}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-muted" />
                Not scanned
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: rankColor(1) }} />
                1
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: rankColor(2) }} />
                2
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: rankColor(3) }} />
                3
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: rankColor(4) }} />
                4–6
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: rankColor(7) }} />
                7–10
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: rankColor(11) }} />
                11–15
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: rankColor(16) }} />
                16+ / not found
              </span>
            </div>
          </div>

          {scanning && (
            <div className="mx-5 mb-3 flex items-center gap-2 rounded-xl border border-brass/25 bg-brass/5 px-4 py-2 text-sm text-paper/80 sm:mx-0">
              <LoaderCircle className="h-4 w-4 animate-spin text-brass" />
              Scanning {searchCount(gridSize)} map points…
            </div>
          )}

          <GridMap
            center={mapCenter}
            points={points}
            selected={selectedPoint}
            onSelect={setSelectedPoint}
          />

          {selectedPoint && (
            <div className="mx-5 mt-4 rounded-xl border border-line bg-ink px-4 py-3 sm:mx-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Selected pin</p>
              <p className="mt-1 text-sm text-paper">
                {selectedPoint.lat.toFixed(5)}, {selectedPoint.lng.toFixed(5)}
              </p>
              <p className="mt-1 text-sm text-paper">
                {selectedPoint.keyword ? `${selectedPoint.keyword} · ` : ""}
                {rankLabel(selectedPoint.rank, selectedPoint.error, selectedPoint.scannedAt, selectedPoint.status)}
                {selectedPoint.rating != null ? ` · ${selectedPoint.rating.toFixed(1)}` : ""}
                {selectedPoint.reviewCount != null ? ` (${selectedPoint.reviewCount} reviews)` : ""}
              </p>
              <p className="mt-1 text-sm text-paper/80">
                {selectedPoint.listingTitle ||
                  (selectedPoint.scannedAt ? "No matching listing at this point" : "Scan this grid to fill ranks and listing details.")}
              </p>
              {selectedPoint.address && <p className="mt-1 text-sm text-muted">{selectedPoint.address}</p>}
              {selectedPoint.domain && <p className="mt-1 text-sm text-muted">{selectedPoint.domain}</p>}
              {selectedPoint.placeId && <p className="mt-1 text-xs text-muted">Place ID {selectedPoint.placeId}</p>}
              <p className="mt-1 text-xs text-muted">
                {selectedPoint.locationCoordinate || `${selectedPoint.lat.toFixed(5)},${selectedPoint.lng.toFixed(5)}`}
                {" · "}
                {formatWhen(selectedPoint.scannedAt)}
              </p>
              {selectedPoint.error && (
                <p className="mt-2 text-sm text-clay">{publicSearchMessage(selectedPoint.error)}</p>
              )}
            </div>
          )}

          {points.length > 0 && !scanning && (
            <div className="mt-4 overflow-x-auto px-5 sm:px-0">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-[0.12em] text-muted">
                  <tr>
                    <th className="pb-3 pr-3 font-semibold">Point</th>
                    <th className="pb-3 pr-3 font-semibold">Rank</th>
                    <th className="pb-3 pr-3 font-semibold">Listing</th>
                    <th className="pb-3 font-semibold">Address</th>
                  </tr>
                </thead>
                <tbody>
                  {points.map((point) => (
                    <tr
                      key={`${point.row}-${point.col}-${point.keyword}`}
                      className="cursor-pointer border-t border-line hover:bg-raised/60"
                      onClick={() => setSelectedPoint(point)}
                    >
                      <td className="py-2.5 pr-3 text-muted">
                        R{point.row + 1} C{point.col + 1}
                        <span className="block text-xs">
                          {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: pinColor(point) }} />
                          <span style={{ color: pinColor(point) }}>
                            {rankLabel(point.rank, point.error, point.scannedAt, point.status)}
                          </span>
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-paper/80">{point.listingTitle || "—"}</td>
                      <td className="max-w-[18rem] truncate py-2.5 text-muted">{point.address || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selected?.lastTrafficJob && (
            <div className="mt-6 border-t border-line px-5 pt-4 sm:px-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Last traffic run</p>
              <p className="mt-2 text-sm text-muted">
                {formatWhen(selected.lastTrafficJob.startedAt)} · {selected.lastTrafficJob.sessionsOk} of{" "}
                {selected.lastTrafficJob.sessionsAttempted} sessions opened the listing
                {selected.lastTrafficJob.requestCount
                  ? ` · ${selected.lastTrafficJob.requestCount} Maps requests`
                  : ""}
                {selected.lastTrafficJob.status === "running" ? " · running" : ""}
              </p>
              {selected.lastTrafficJob.lastError && selected.lastTrafficJob.sessionsOk === 0 && (
                <p className="mt-1 text-sm text-clay">{selected.lastTrafficJob.lastError}</p>
              )}
            </div>
          )}

          {selected?.recentGridScans && selected.recentGridScans.length > 0 && (
            <div className="mt-6 border-t border-line px-5 pt-4 sm:px-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Recent grid scans</p>
              <ul className="mt-2 grid gap-1 text-sm text-muted">
                {selected.recentGridScans.slice(0, 5).map((run) => (
                  <li key={run.id}>
                    {formatWhen(run.scannedAt)} · {run.keyword} · {run.foundCount} of {run.pointCount} found
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function ListingResults({
  searching,
  result,
  listings,
  confirmed,
  onConfirm,
}: {
  searching: boolean
  result: SearchResponse | null
  listings: BusinessListing[]
  confirmed: ConfirmedListing | null
  onConfirm: (listing: BusinessListing) => void
}) {
  if (searching) {
    return (
      <div className="mt-4 rounded-xl border border-line bg-ink px-4 py-5">
        <p className="text-sm text-paper">Looking up Maps listings…</p>
        <p className="mt-1 text-sm text-muted">Matching name, city, and state.</p>
      </div>
    )
  }

  if (!result) {
    return (
      <p className="mt-3 text-sm text-muted">
        {confirmed
          ? "This listing is confirmed. Search again if you need a different match."
          : "Search for the business first. Matches show title, address, and rating — click one to confirm it."}
      </p>
    )
  }

  if (listings.length === 0) {
    return (
      <div className="mt-4 rounded-xl border border-line bg-ink px-4 py-5">
        <p className="font-display text-xl text-paper">No listing matched</p>
        <p className="mt-1 text-sm text-muted">
          {publicSearchMessage(result.error || result.warning) || "Check the spelling, or try a closer city name."}
        </p>
      </div>
    )
  }

  return (
    <ul className="mt-4 grid gap-2">
      {listings.map((listing) => {
        const selected = Boolean(confirmed && confirmed.placeId === listing.placeId?.trim() && confirmed.title === listing.title)
        return (
          <li key={`${listing.placeId || listing.title}-${listing.address}`}>
            <button
              type="button"
              onClick={() => onConfirm(listing)}
              className={`w-full rounded-xl border px-4 py-3 text-left ${selected ? "border-brass bg-brass/10" : "border-line bg-ink hover:border-brass/60"}`}
            >
              <span className="flex flex-wrap items-start justify-between gap-2">
                <span>
                  {selected && (
                    <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">
                      Selected business
                    </span>
                  )}
                  <span className="block font-display text-xl text-paper">{listing.title}</span>
                  <span className="mt-1 block text-sm text-muted">{listing.address}</span>
                </span>
                {listing.rating != null && (
                  <span className="inline-flex items-center gap-1 text-sm text-brass">
                    <Star className="h-4 w-4 fill-current" />
                    {listing.rating.toFixed(1)}
                    {listing.reviewCount != null && (
                      <span className="text-muted">({listing.reviewCount.toLocaleString()})</span>
                    )}
                  </span>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
