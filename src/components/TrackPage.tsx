import { ExternalLink, LoaderCircle, Plus, Star, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState, type FormEvent } from "react"
import { createCampaign, deleteCampaign, loadCampaigns, scanCampaign, updateCampaign } from "../lib/api.ts"
import { US_STATES } from "../lib/states.ts"
import type { ApiKeys, Campaign, CampaignInput, HostedKeyStatus, KeywordRank } from "../lib/types.ts"

type Props = {
  keys: ApiKeys
  hosted: HostedKeyStatus | null
  seller: boolean
}

const emptyDraft = (): CampaignInput => ({
  name: "",
  businessName: "",
  city: "",
  state: "",
  keywords: [],
})

function formatWhen(value: string | null | undefined): string {
  if (!value) return "Not scanned yet"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Not scanned yet"
  return date.toLocaleString()
}

function rankLabel(row: KeywordRank | undefined): string {
  if (!row) return "—"
  if (row.error) return "Error"
  if (row.rank == null) return "Not found"
  return String(row.rank)
}

function lastRankFor(campaign: Campaign, keyword: string): KeywordRank | undefined {
  return campaign.lastScan?.results.find((row) => row.keyword.toLowerCase() === keyword.toLowerCase())
}

export function TrackPage({ keys, hosted, seller }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [maxKeywords, setMaxKeywords] = useState(20)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<CampaignInput>(emptyDraft)
  const [keywordDraft, setKeywordDraft] = useState("")
  const [creating, setCreating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const selected = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedId) ?? null,
    [campaigns, selectedId],
  )

  async function refresh(nextId?: string | null) {
    const payload = await loadCampaigns()
    setCampaigns(payload.campaigns)
    setMaxKeywords(payload.maxKeywords)
    const keep = nextId !== undefined ? nextId : selectedId
    const next = payload.campaigns.find((campaign) => campaign.id === keep) ?? payload.campaigns[0] ?? null
    setSelectedId(next?.id ?? null)
    if (next) {
      setDraft({
        name: next.name,
        businessName: next.businessName,
        city: next.city,
        state: next.state,
        keywords: next.keywords,
      })
    } else {
      setDraft(emptyDraft())
    }
    return payload.campaigns
  }

  useEffect(() => {
    let active = true
    void loadCampaigns()
      .then((payload) => {
        if (!active) return
        setCampaigns(payload.campaigns)
        setMaxKeywords(payload.maxKeywords)
        const next = payload.campaigns[0] ?? null
        setSelectedId(next?.id ?? null)
        if (next) {
          setDraft({
            name: next.name,
            businessName: next.businessName,
            city: next.city,
            state: next.state,
            keywords: next.keywords,
          })
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

  function replaceCampaign(next: Campaign) {
    setCampaigns((current) => current.map((row) => (row.id === next.id ? next : row)))
    if (selectedId === next.id) {
      setDraft({
        name: next.name,
        businessName: next.businessName,
        city: next.city,
        state: next.state,
        keywords: next.keywords,
      })
    }
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const campaign = await createCampaign(draft)
      setCreating(false)
      setKeywordDraft("")
      await refresh(campaign.id)
      setNotice("Campaign saved. Add keywords, then scan Google Maps.")
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
        }),
      )
      setNotice("Campaign details saved.")
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
      replaceCampaign(await updateCampaign(selected.id, { keywords: selected.keywords.filter((row) => row !== keyword) }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove that keyword.")
    } finally {
      setSaving(false)
    }
  }

  async function onDelete() {
    if (!selected) return
    if (!window.confirm(`Delete “${selected.name}”? This removes the campaign and its scan history.`)) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      await deleteCampaign(selected.id)
      await refresh(null)
      setCreating(false)
      setNotice("Campaign deleted.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the campaign.")
    } finally {
      setSaving(false)
    }
  }

  async function onScan(keywords?: string[]) {
    if (!selected) return
    setScanning(keywords?.[0] ?? "all")
    setError(null)
    setNotice(null)
    try {
      const payload = await scanCampaign(selected.id, keys, Boolean(hosted?.included && !seller), keywords)
      replaceCampaign(payload.campaign)
      const found = payload.scan.foundCount
      const total = payload.scan.keywordCount
      setNotice(
        found === total
          ? `Scan finished. Found the business for ${found} of ${total} keywords.`
          : `Scan finished. Found the business for ${found} of ${total} keywords. Missing ranks mean it was not in the Maps results.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not scan Google Maps.")
    } finally {
      setScanning(null)
    }
  }

  function startCreate() {
    setCreating(true)
    setSelectedId(null)
    setDraft(emptyDraft())
    setKeywordDraft("")
    setError(null)
    setNotice(null)
  }

  function selectCampaign(campaign: Campaign) {
    setCreating(false)
    setSelectedId(campaign.id)
    setDraft({
      name: campaign.name,
      businessName: campaign.businessName,
      city: campaign.city,
      state: campaign.state,
      keywords: campaign.keywords,
    })
    setKeywordDraft("")
    setError(null)
    setNotice(null)
  }

  const results = selected
    ? selected.keywords.map((keyword) => lastRankFor(selected, keyword)).filter((row): row is KeywordRank => Boolean(row))
    : []
  const mapsReady = Boolean((keys.dataforseoLogin && keys.dataforseoPassword) || hosted?.dataforseo)
  const busy = Boolean(saving || scanning)

  if (loading) {
    return (
      <section className="rounded-2xl border border-line bg-panel p-8">
        <p className="font-display text-2xl text-paper">Loading campaigns</p>
        <p className="mt-2 text-sm text-muted">Reading saved rank-tracking campaigns from this computer.</p>
      </section>
    )
  }

  return (
    <div className="grid flex-1 gap-6 lg:grid-cols-[18.5rem_1fr]">
      <aside className="rounded-2xl border border-line bg-panel p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Campaigns</p>
            <h2 className="font-display text-2xl text-paper">Track ranks</h2>
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
          Watch where a Google Maps listing appears for the keywords people search in that city.
        </p>
        {campaigns.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-sm text-muted">
            No campaigns yet. Create one with a business name, city, and the keywords you want to rank.
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
                      {campaign.keywords.length} keyword{campaign.keywords.length === 1 ? "" : "s"}
                      {campaign.lastScan
                        ? ` · ${campaign.lastScan.foundCount} found ${formatWhen(campaign.lastScan.scannedAt)}`
                        : " · not scanned"}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </aside>

      <main className="grid gap-4">
        {error && (
          <p className="rounded-xl border border-clay/40 bg-panel px-4 py-3 text-sm text-clay">{error}</p>
        )}
        {notice && (
          <p className="rounded-xl border border-brass/30 bg-brass/10 px-4 py-3 text-sm text-brass">{notice}</p>
        )}

        {creating || !selected ? (
          <section className="rounded-2xl border border-dashed border-line bg-panel/60 p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">New campaign</p>
            <h3 className="mt-2 font-display text-3xl text-paper">Track a Google Maps listing</h3>
            <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
              PlaceFind searches each keyword on Google Maps in that city, then records the rank of the listing that
              matches your business name. A campaign can hold up to {maxKeywords} keywords.
            </p>
            <form className="mt-6 grid gap-4" onSubmit={(event) => void onCreate(event)}>
              <CampaignFields draft={draft} onChange={setDraft} />
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brass font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
              >
                {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {saving ? "Saving campaign…" : "Create campaign"}
              </button>
            </form>
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
                <CampaignFields draft={draft} onChange={setDraft} />
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
                    {selected.keywords.length} of {maxKeywords} keywords. Each scan looks up that keyword on Google Maps.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void onScan()}
                  disabled={busy || selected.keywords.length === 0}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
                >
                  {scanning === "all" && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {scanning === "all" ? "Scanning Maps…" : "Scan keywords"}
                </button>
              </div>
              {!mapsReady && (
                <p className="mt-4 rounded-xl border border-clay/40 px-4 py-3 text-sm text-clay">
                  {seller
                    ? "Rank scans need live Maps search. Add keys in Settings, or seal them on Sell."
                    : "Maps rank tracking is not ready on this preview yet."}
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
                <ul className="mt-4 flex flex-wrap gap-2">
                  {selected.keywords.map((keyword) => (
                    <li
                      key={keyword}
                      className="inline-flex items-center gap-2 rounded-full border border-line bg-ink px-3 py-1.5 text-sm text-paper"
                    >
                      {keyword}
                      <button
                        type="button"
                        onClick={() => void onRemoveKeyword(keyword)}
                        disabled={busy}
                        className="text-muted hover:text-clay"
                        aria-label={`Remove ${keyword}`}
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Latest ranks</p>
              <h4 className="font-display text-2xl text-paper">Where the listing appears</h4>
              {selected.keywords.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Add keywords, then run a scan to see ranks.</p>
              ) : results.length === 0 ? (
                <p className="mt-3 text-sm text-muted">
                  No scan yet. Click Scan keywords to ask Google Maps where {selected.businessName} ranks.
                </p>
              ) : (
                <>
                  <div className="mt-4 hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[44rem] text-left text-sm">
                      <thead className="text-[11px] uppercase tracking-[0.12em] text-muted">
                        <tr>
                          <th className="pb-3 pr-3 font-semibold">Keyword</th>
                          <th className="pb-3 pr-3 font-semibold">Rank</th>
                          <th className="pb-3 pr-3 font-semibold">Listing</th>
                          <th className="pb-3 pr-3 font-semibold">Rating</th>
                          <th className="pb-3 pr-3 font-semibold">Address</th>
                          <th className="pb-3 pr-3 font-semibold">Scanned</th>
                          <th className="pb-3 font-semibold" />
                        </tr>
                      </thead>
                      <tbody>
                        {selected.keywords.map((keyword) => {
                          const row = lastRankFor(selected, keyword)
                          return (
                            <tr key={keyword} className="border-t border-line">
                              <td className="py-3 pr-3 text-paper">{keyword}</td>
                              <td className="py-3 pr-3 text-brass">{rankLabel(row)}</td>
                              <td className="py-3 pr-3 text-paper/80">{row?.listingTitle || "—"}</td>
                              <td className="py-3 pr-3 text-paper/80">
                                {row?.rating != null ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Star className="h-3.5 w-3.5 fill-current text-brass" />
                                    {row.rating.toFixed(1)}
                                  </span>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td className="max-w-[16rem] truncate py-3 pr-3 text-muted">{row?.address || "—"}</td>
                              <td className="py-3 pr-3 text-muted">{row ? formatWhen(row.scannedAt) : "—"}</td>
                              <td className="py-3 text-right">
                                <ResultActions
                                  row={row}
                                  scanning={scanning === keyword}
                                  disabled={busy}
                                  onScan={() => void onScan([keyword])}
                                />
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <ul className="mt-4 grid gap-3 md:hidden">
                    {selected.keywords.map((keyword) => {
                      const row = lastRankFor(selected, keyword)
                      return (
                        <li key={keyword} className="rounded-xl border border-line bg-ink p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm text-paper">{keyword}</p>
                              <p className="mt-1 text-lg text-brass">{rankLabel(row)}</p>
                            </div>
                            <ResultActions
                              row={row}
                              scanning={scanning === keyword}
                              disabled={busy}
                              onScan={() => void onScan([keyword])}
                            />
                          </div>
                          <p className="mt-2 text-sm text-paper/80">{row?.listingTitle || "No matching listing yet"}</p>
                          {row?.address && <p className="mt-1 text-sm text-muted">{row.address}</p>}
                          <p className="mt-2 text-xs text-muted">{row ? formatWhen(row.scannedAt) : "Not scanned yet"}</p>
                          {row?.error && <p className="mt-2 text-sm text-clay">{row.error}</p>}
                        </li>
                      )
                    })}
                  </ul>
                </>
              )}
              {selected.recentScans.length > 0 && (
                <div className="mt-6 border-t border-line pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Recent scans</p>
                  <ul className="mt-2 grid gap-1 text-sm text-muted">
                    {selected.recentScans.slice(0, 5).map((run) => (
                      <li key={run.id}>
                        {formatWhen(run.scannedAt)} · {run.foundCount} of {run.keywordCount} found
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
}: {
  draft: CampaignInput
  onChange: (draft: CampaignInput) => void
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
    </div>
  )
}

function ResultActions({
  row,
  scanning,
  disabled,
  onScan,
}: {
  row?: KeywordRank
  scanning: boolean
  disabled: boolean
  onScan: () => void
}) {
  return (
    <div className="inline-flex items-center gap-2">
      {row?.mapsUrl && (
        <a
          href={row.mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-paper/80 hover:text-brass"
        >
          Maps
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
      <button
        type="button"
        onClick={onScan}
        disabled={disabled}
        className="rounded-md border border-line px-2.5 py-1 text-xs text-paper/80 hover:border-brass disabled:opacity-60"
      >
        {scanning ? "Scanning…" : "Scan"}
      </button>
    </div>
  )
}
