import { LoaderCircle, Plus, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  createCampaign,
  deleteCampaign,
  geocodePlace,
  loadCampaignGrid,
  loadCampaigns,
  scanCampaign,
  updateCampaign,
} from "../lib/api.ts"
import { buildPreviewPoints, pinColor, rankLabel, rankTone } from "../lib/grid.ts"
import { publicSearchMessage } from "../lib/public-copy.ts"
import { US_STATES } from "../lib/states.ts"
import type { ApiKeys, Campaign, CampaignInput, GeoPoint, GridPointResult, HostedKeyStatus } from "../lib/types.ts"
import { GridMap } from "./GridMap.tsx"

type Props = {
  keys: ApiKeys
  hosted: HostedKeyStatus | null
  seller: boolean
  desktop?: boolean
}

const emptyDraft = (): CampaignInput => ({
  name: "",
  businessName: "",
  city: "",
  state: "",
  keywords: [],
  gridSize: 5,
  spacingMiles: 1,
})

function formatWhen(value: string | null | undefined): string {
  if (!value) return "Not scanned yet"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not scanned yet"
  return date.toLocaleString()
}

function draftFrom(campaign: Campaign): CampaignInput {
  return {
    name: campaign.name,
    businessName: campaign.businessName,
    city: campaign.city,
    state: campaign.state,
    keywords: campaign.keywords,
    gridSize: campaign.gridSize ?? 5,
    spacingMiles: campaign.spacingMiles ?? 1,
  }
}

function searchCount(gridSize: number) {
  return gridSize * gridSize
}

export function TrackPage({ keys, hosted, seller, desktop }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [maxKeywords, setMaxKeywords] = useState(20)
  const [allowedGridSizes, setAllowedGridSizes] = useState([3, 5, 7])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CampaignInput>(emptyDraft)
  const [keywordDraft, setKeywordDraft] = useState("")
  const [activeKeyword, setActiveKeyword] = useState("")
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<GridPointResult | null>(null)
  const [previewCenter, setPreviewCenter] = useState<GeoPoint | null>(null)
  const [locating, setLocating] = useState(false)

  const selected = useMemo(
    () => (campaigns ?? []).find((campaign) => campaign.id === selectedId) ?? null,
    [campaigns, selectedId],
  )

  const grid = selected?.lastGridScan ?? null
  const gridSize = Number(draft.gridSize || selected?.gridSize || 5)
  const spacingMiles = Number(draft.spacingMiles || selected?.spacingMiles || 1)
  const mapCenter = selected?.center || grid?.center || previewCenter
  const points = useMemo(() => {
    const keyword = activeKeyword || selected?.keywords[0] || ""
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
    if (!mapCenter) return []
    return buildPreviewPoints(mapCenter, gridSize, spacingMiles, keyword)
  }, [grid, activeKeyword, gridSize, spacingMiles, mapCenter, selected?.keywords])

  async function refresh(nextId?: string | null) {
    const payload = await loadCampaigns()
    const rows = payload.campaigns ?? []
    setCampaigns(rows)
    setMaxKeywords(payload.maxKeywords)
    setAllowedGridSizes(payload.allowedGridSizes)
    const keep = nextId !== undefined ? nextId : selectedId
    const next = rows.find((campaign) => campaign.id === keep) ?? rows[0] ?? null
    setSelectedId(next?.id ?? null)
    if (next) {
      setDraft(draftFrom(next))
      setActiveKeyword(next.lastGridScan?.keyword || next.keywords[0] || "")
    } else {
      setDraft(emptyDraft())
      setActiveKeyword("")
    }
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
        if (next) {
          setDraft(draftFrom(next))
          setActiveKeyword(next.lastGridScan?.keyword || next.keywords[0] || "")
        } else {
          setCreating(true)
        }
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
    if (!creating) return
    const city = draft.city?.trim() ?? ""
    const state = draft.state?.trim() ?? ""
    if (city.length < 2 || !state) {
      setPreviewCenter(null)
      return
    }
    const timer = window.setTimeout(() => {
      setLocating(true)
      void geocodePlace(city, state)
        .then((center) => setPreviewCenter(center))
        .catch(() => setPreviewCenter(null))
        .finally(() => setLocating(false))
    }, 400)
    return () => window.clearTimeout(timer)
  }, [creating, draft.city, draft.state])

  useEffect(() => {
    if (!selected || creating) return
    if (selected.center || selected.lastGridScan?.center) {
      setPreviewCenter(selected.center || selected.lastGridScan?.center || null)
      return
    }
    let active = true
    setLocating(true)
    void loadCampaignGrid(selected.id, { gridSize, spacingMiles })
      .then((payload) => {
        if (!active) return
        replaceCampaign(payload.campaign)
        setPreviewCenter(payload.center)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not place the grid on the map.")
      })
      .finally(() => {
        if (active) setLocating(false)
      })
    return () => {
      active = false
    }
  }, [selected?.id, selected?.center, selected?.city, selected?.state, creating, gridSize, spacingMiles])

  useEffect(() => {
    if (!selectedPoint) return
    const next = points.find((point) => point.row === selectedPoint.row && point.col === selectedPoint.col)
    if (!next) setSelectedPoint(null)
    else if (next !== selectedPoint) setSelectedPoint(next)
  }, [points, selectedPoint])

  function replaceCampaign(next: Campaign) {
    setCampaigns((current) => current.map((row) => (row.id === next.id ? next : row)))
    if (selectedId === next.id) {
      setDraft(draftFrom(next))
      if (next.lastGridScan?.keyword) setActiveKeyword(next.lastGridScan.keyword)
    }
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const keywords = draft.keywords?.length ? draft.keywords : keywordDraft.trim() ? [keywordDraft.trim()] : []
      const campaign = await createCampaign({ ...draft, keywords })
      setCreating(false)
      setKeywordDraft("")
      await refresh(campaign.id)
      setActiveKeyword(campaign.keywords[0] || "")
      try {
        const preview = await loadCampaignGrid(campaign.id, {
          gridSize: campaign.gridSize,
          spacingMiles: campaign.spacingMiles,
        })
        replaceCampaign(preview.campaign)
        setPreviewCenter(preview.center)
      } catch {
        // Map stays on the city pin after the next locate pass.
      }
      setNotice(
        `Campaign saved. A ${campaign.gridSize}×${campaign.gridSize} scan runs ${searchCount(campaign.gridSize)} Maps searches.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the campaign.")
    } finally {
      setSaving(false)
    }
  }

  async function onSave() {
    if (!selected) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      replaceCampaign(
        await updateCampaign(selected.id, {
          name: draft.name,
          businessName: draft.businessName,
          city: draft.city,
          state: draft.state,
          gridSize: draft.gridSize,
          spacingMiles: draft.spacingMiles,
        }),
      )
      setNotice("Campaign details saved. The next scan uses this grid.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the campaign.")
    } finally {
      setSaving(false)
    }
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
      await refresh(null)
      setCreating(true)
      setNotice("Campaign deleted.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the campaign.")
    } finally {
      setSaving(false)
    }
  }

  async function onScan(keyword?: string) {
    if (!selected) return
    const target = (keyword || activeKeyword || selected.keywords[0] || "").trim()
    if (!target) {
      setError("Add a keyword before running a grid scan.")
      return
    }
    setScanning(true)
    setError(null)
    setNotice(null)
    setSelectedPoint(null)
    try {
      const payload = await scanCampaign(selected.id, keys, Boolean(hosted?.included && !seller), [target])
      replaceCampaign(payload.campaign)
      setActiveKeyword(payload.grid?.keyword || target)
      const found = payload.grid?.foundCount ?? 0
      const total = payload.grid?.pointCount ?? 0
      setNotice(
        `Scan finished. ${selected.businessName} appeared at ${found} of ${total} grid points for “${target}”.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not scan Maps.")
    } finally {
      setScanning(false)
    }
  }

  function startCreate() {
    setCreating(true)
    setSelectedId(null)
    setDraft(emptyDraft())
    setKeywordDraft("")
    setActiveKeyword("")
    setSelectedPoint(null)
    setPreviewCenter(null)
    setError(null)
    setNotice(null)
  }

  function selectCampaign(campaign: Campaign) {
    setCreating(false)
    setSelectedId(campaign.id)
    setDraft(draftFrom(campaign))
    setKeywordDraft("")
    setActiveKeyword(campaign.lastGridScan?.keyword || campaign.keywords[0] || "")
    setSelectedPoint(null)
    setPreviewCenter(campaign.center || campaign.lastGridScan?.center || null)
    setError(null)
    setNotice(null)
  }

  function onDraftChange(next: CampaignInput) {
    const gridChanged = next.gridSize !== draft.gridSize || next.spacingMiles !== draft.spacingMiles
    setDraft(next)
    if (!selected || creating || !gridChanged) return
    void updateCampaign(selected.id, { gridSize: next.gridSize, spacingMiles: next.spacingMiles })
      .then(replaceCampaign)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not save the grid."))
  }

  const mapsReady = Boolean((keys.dataforseoLogin && keys.dataforseoPassword) || hosted?.dataforseo)
  const busy = Boolean(saving || scanning)

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
          Drop a grid around a listing and see where it ranks on Maps from each point.
        </p>
        {campaigns.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-sm text-muted">
            No campaigns yet. Create one with a business, a keyword, and a 3×3, 5×5, or 7×7 grid.
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
                    <span className="block truncate text-sm">{campaign.name}</span>
                    <span className="block text-xs text-muted">
                      {campaign.businessName} · {campaign.city}, {campaign.state}
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

        {creating || !selected ? (
          <section className="rounded-2xl border border-dashed border-line bg-panel/60 p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">New campaign</p>
            <h3 className="mt-2 font-display text-3xl text-paper">Track ranks on a map grid</h3>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
              PlaceFind looks up the listing, then searches your keyword from every grid point around it. A 5×5 grid
              is 25 Maps searches. 7×7 is 49 — that costs more.
            </p>
            <form className="mt-6 grid gap-4" onSubmit={(event) => void onCreate(event)}>
              <CampaignFields draft={draft} onChange={onDraftChange} allowedGridSizes={allowedGridSizes} />
              <label className="grid gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">First keyword</span>
                <input
                  value={keywordDraft}
                  onChange={(event) => setKeywordDraft(event.target.value)}
                  placeholder="barbecue"
                  autoComplete="off"
                  className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none placeholder:text-muted/50 focus:border-brass"
                />
              </label>
              <p className="text-xs text-muted">
                A {gridSize}×{gridSize} grid runs {searchCount(gridSize)} Maps searches on each scan.
              </p>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brass font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
              >
                {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {saving ? "Saving campaign…" : "Create campaign"}
              </button>
            </form>
            <div className="mt-6 overflow-hidden rounded-2xl border border-line">
              <div className="flex flex-wrap items-end justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Preview grid</p>
                  <p className="mt-1 text-sm text-muted">
                    {mapCenter
                      ? `A ${gridSize}×${gridSize} pin grid around ${draft.city || "this city"}, ${draft.state || ""}.`
                      : "Add a city and state to drop GPS pins on the map."}
                  </p>
                </div>
                {locating && <LoaderCircle className="h-4 w-4 animate-spin text-brass" />}
              </div>
              <GridMap center={mapCenter} points={points} selected={selectedPoint} onSelect={setSelectedPoint} />
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Campaign</p>
                  <h3 className="font-display text-3xl text-paper">{selected.name}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {selected.businessName} in {selected.city}, {selected.state}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onDelete()}
                  disabled={busy}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm text-paper/80 hover:border-clay hover:text-clay disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
              <div className="mt-5 grid gap-4">
                <CampaignFields draft={draft} onChange={onDraftChange} allowedGridSizes={allowedGridSizes} />
                <button
                  type="button"
                  onClick={() => void onSave()}
                  disabled={busy}
                  className="inline-flex h-11 w-full items-center justify-center rounded-lg border border-line text-sm text-paper/80 hover:border-brass disabled:opacity-60 sm:w-auto sm:px-5"
                >
                  {saving && !scanning ? "Saving…" : "Save details"}
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Keywords</p>
                  <h4 className="font-display text-2xl text-paper">What people search</h4>
                  <p className="mt-1 text-sm text-muted">
                    Scan one keyword at a time. Each point on the grid is its own Maps search.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onScan()}
                  disabled={busy || selected.keywords.length === 0}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
                >
                  {scanning && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {scanning ? "Scanning the grid…" : `Scan ${draft.gridSize ?? selected.gridSize}×${draft.gridSize ?? selected.gridSize} grid`}
                </button>
              </div>
              {!mapsReady && (
                <p className="mt-4 rounded-xl border border-clay/40 px-4 py-3 text-sm text-clay">
                  Maps rank tracking is not ready on this copy yet.
                </p>
              )}
              {mapsReady && (
                <p className="mt-4 rounded-xl border border-brass/25 bg-brass/5 px-4 py-3 text-sm text-paper/80">
                  A {draft.gridSize || selected.gridSize}×{draft.gridSize || selected.gridSize} scan runs{" "}
                  {searchCount(Number(draft.gridSize || selected.gridSize))} paid Maps searches — one for each grid
                  point, from that point’s coordinates. A 7×7 scan is 49 paid searches.
                  {desktop ? " Larger grids take a few minutes." : ""}
                </p>
              )}
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
                  placeholder="barbecue"
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
              {selected.keywords.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Add a keyword such as “barbecue” or “best pizza” to start tracking.</p>
              ) : (
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

            <section className="overflow-hidden rounded-2xl border border-line bg-panel p-0 sm:p-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-5 pt-5 sm:px-0 sm:pt-0">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Map grid</p>
                  <h4 className="font-display text-2xl text-paper">Where the listing ranks</h4>
                  <p className="mt-1 text-sm text-muted">
                    Pins mark every {gridSize}×{gridSize} search point. Green is ranks 1–3, brass is 4–10, clay is 11+
                    or not found. Click a pin for coordinates and the listing snippet.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-muted" />
                    Not scanned
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-moss" />
                    1–3
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-brass" />
                    4–10
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-clay" />
                    11+ / missing
                  </span>
                </div>
              </div>

              {(scanning || locating) && (
                <div className="mx-5 mb-3 flex items-center gap-2 rounded-xl border border-brass/25 bg-brass/5 px-4 py-2 text-sm text-paper/80 sm:mx-0">
                  <LoaderCircle className="h-4 w-4 animate-spin text-brass" />
                  {scanning
                    ? `Scanning ${searchCount(gridSize)} map points…`
                    : `Placing a ${gridSize}×${gridSize} grid around ${selected.city}, ${selected.state}…`}
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
                    {rankLabel(selectedPoint.rank, selectedPoint.error, selectedPoint.scannedAt)}
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
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ background: pinColor(point) }}
                              />
                              <span className={rankTone(point.rank) === "red" ? "text-clay" : "text-brass"}>
                                {rankLabel(point.rank, point.error, point.scannedAt)}
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

              {selected.recentGridScans && selected.recentGridScans.length > 0 && (
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
          </>
        )}
      </main>
    </div>
  )
}

function CampaignFields({
  draft,
  onChange,
  allowedGridSizes,
}: {
  draft: CampaignInput
  onChange: (draft: CampaignInput) => void
  allowedGridSizes: number[]
}) {
  return (
    <div className="grid gap-3">
      <label className="grid gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Campaign name</span>
        <input
          value={draft.name ?? ""}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder="Austin barbecue"
          autoComplete="off"
          className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none placeholder:text-muted/50 focus:border-brass"
        />
      </label>
      <label className="grid gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Business name</span>
        <input
          value={draft.businessName ?? ""}
          onChange={(event) => onChange({ ...draft, businessName: event.target.value })}
          placeholder="Franklin Barbecue"
          autoComplete="off"
          className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none placeholder:text-muted/50 focus:border-brass"
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_7.5rem]">
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">City</span>
          <input
            value={draft.city ?? ""}
            onChange={(event) => onChange({ ...draft, city: event.target.value })}
            placeholder="Austin"
            autoComplete="off"
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none placeholder:text-muted/50 focus:border-brass"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">State</span>
          <select
            value={draft.state ?? ""}
            onChange={(event) => onChange({ ...draft, state: event.target.value })}
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Grid size</span>
          <select
            value={draft.gridSize ?? 5}
            onChange={(event) => onChange({ ...draft, gridSize: Number(event.target.value) })}
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
            value={draft.spacingMiles ?? 1}
            onChange={(event) => onChange({ ...draft, spacingMiles: Number(event.target.value) })}
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
          />
        </label>
      </div>
    </div>
  )
}
