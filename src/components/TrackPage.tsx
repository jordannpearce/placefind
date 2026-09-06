import { LoaderCircle, Plus, Star, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import {
  compareCampaignScans,
  confirmListingMatch,
  createCampaign,
  deleteCampaign,
  loadAccount,
  loadCampaign,
  loadCampaignGrid,
  loadCampaignScans,
  loadCampaigns,
  loadCampaignTraffic,
  previewGeoPoints,
  rerunCampaignScan,
  scanCampaign,
  searchBusiness,
  startCampaignTraffic,
  stopCampaignTraffic,
  updateCampaign,
} from "../lib/api.ts"
import { listingLocation, listingMapsMatchFromPlace } from "../lib/listings.ts"
import { buildPreviewPoints, gridPinId, gridPinLabel, pinColor, rankColor, rankLabel } from "../lib/grid.ts"
import { pointsWithCompare, rankChangeColor, rankChangeLabel } from "../lib/scan-compare.ts"
import { mapsKeysMissingAdminMessage, publicPinScanMessage, publicSearchMessage, usingCityGpsBackupNote } from "../lib/public-copy.ts"
import { CityStateFields } from "./CityStateFields.tsx"
import {
  campaignInputFromListing,
  competitorsGeoFilterLabel,
  confirmedFromOwnedListingNotice,
  confirmedListingFromCampaign,
  confirmedListingFromDirectory,
  confirmedListingFromSearch,
  filterCompetitors,
  listingsFromSearch,
  ownedListingLookupFailedMessage,
  ownedListingNeedsConfirmMessage,
  ownedListingTrackHint,
  pickMapsPlaceForListing,
  rollupCompetitors,
  campaignScanFinished,
  countFinishedScanPins,
  listedTrafficKeywords,
  noKeywordsSelectedMessage,
  noPinsSelectedMessage,
  scanBusinessEnabled,
  scanGridPageError,
  scanLiveStatus,
  searchQueryFromListing,
  selectedKeywordsInListedOrder,
  shouldPersistOwnedListingMatch,
  trafficKeywordHelpCopy,
  searchChanged,
  searchQueryFromCampaign,
  startTrafficEnabled,
  startTrafficLabel,
  startTrafficVisible,
  stopTrafficVisible,
  trafficLogEmptyCopy,
  trafficLogLoadingCopy,
  trafficPinStatusLabel,
} from "../lib/track.ts"
import {
  DEFAULT_TRAFFIC_SEARCHES,
  MAX_TRAFFIC_SEARCHES,
  normalizeTrafficSearches,
  plannedTrafficSearchCount,
  trafficSearchHelpCopy,
  trafficStartConfirmCopy,
} from "../lib/traffic-plan.ts"
import {
  formatKeywordText,
  keywordHelpCopy,
  mergeKeywordLists,
  parseKeywordText,
  parseKeywordsOrError,
  scanKeywordsLabel,
  trafficKeywordTypeHelpCopy,
} from "../lib/keywords.ts"
import type {
  ApiKeys,
  BusinessListing,
  Campaign,
  CompetitorListing,
  ConfirmedListing,
  DirectoryListing,
  GeoPoint,
  GridPoint,
  GridPointResult,
  PinSource,
  HostedKeyStatus,
  SearchQuery,
  SearchResponse,
  GridScanRun,
  OwnGeoFlags,
  ScanCompare,
  ScanSchedule,
  TrafficJob,
  TrafficLogLine,
  TrafficPinResult,
  TrafficSchedule,
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

function gridSearchCount(gridSize: number) {
  return gridSize * gridSize
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const

function emptyScanSchedule(): ScanSchedule {
  return { enabled: false, cadence: "daily", hour: 9, minute: 0, timeZone: "local", lastRunAt: null, nextRunAt: null }
}

function emptyTrafficSchedule(): TrafficSchedule {
  return {
    ...emptyScanSchedule(),
    pinMode: "selected",
    lastSelectedPinIds: [],
    lastSelectedKeywords: [],
    lastSearchCount: DEFAULT_TRAFFIC_SEARCHES,
  }
}

function scanWhen(run: { finishedAt?: string; scannedAt?: string; startedAt?: string }) {
  return formatWhen(run.finishedAt || run.scannedAt || run.startedAt)
}

export function TrackPage({ keys, hosted, seller, desktop }: Props) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [maxKeywords, setMaxKeywords] = useState(20)
  const [allowedGridSizes, setAllowedGridSizes] = useState([3, 5, 7])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState<SearchQuery>(emptyQuery)
  const [keywordDraft, setKeywordDraft] = useState("")
  const [trafficKeywordDraft, setTrafficKeywordDraft] = useState("")
  const [activeKeyword, setActiveKeyword] = useState("")
  const [gridSize, setGridSize] = useState(5)
  const [spacingMiles, setSpacingMiles] = useState(1)
  const [pinSource, setPinSource] = useState<PinSource>("grid")
  const [cityGpsPreview, setCityGpsPreview] = useState<GridPoint[] | null>(null)
  const [usedCityGps, setUsedCityGps] = useState(false)
  const [creating, setCreating] = useState(true)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [startingTraffic, setStartingTraffic] = useState(false)
  const [stoppingTraffic, setStoppingTraffic] = useState(false)
  const [trafficPollError, setTrafficPollError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null)
  const [confirmed, setConfirmed] = useState<ConfirmedListing | null>(null)
  const [selectedPoint, setSelectedPoint] = useState<GridPointResult | null>(null)
  const [selectedPinIds, setSelectedPinIds] = useState<string[]>([])
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([])
  const [searchCount, setSearchCount] = useState(DEFAULT_TRAFFIC_SEARCHES)
  const [previewCenter, setPreviewCenter] = useState<GeoPoint | null>(null)
  const [scans, setScans] = useState<GridScanRun[]>([])
  const [compareFromId, setCompareFromId] = useState("")
  const [compareToId, setCompareToId] = useState("")
  const [compare, setCompare] = useState<ScanCompare | null>(null)
  const [comparing, setComparing] = useState(false)
  const [rerunning, setRerunning] = useState(false)
  const [scanScheduleDraft, setScanScheduleDraft] = useState<ScanSchedule>(emptyScanSchedule)
  const [trafficScheduleDraft, setTrafficScheduleDraft] = useState<TrafficSchedule>(emptyTrafficSchedule)
  const [competitorsGeoOnly, setCompetitorsGeoOnly] = useState(false)
  const [competitorsScope, setCompetitorsScope] = useState<"all" | "pin">("all")
  const [ownedListings, setOwnedListings] = useState<DirectoryListing[]>([])
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null)

  const selected = useMemo(
    () => (campaigns ?? []).find((campaign) => campaign.id === selectedId) ?? null,
    [campaigns, selectedId],
  )

  const listings = listingsFromSearch(searchResult)
  const canScan = scanBusinessEnabled(confirmed)
  const grid = selected?.lastGridScan ?? null
  const comparedPoints = useMemo(() => {
    if (!compare) return null
    return pointsWithCompare(compare.current, compare)
  }, [compare])
  const mapCenter = confirmed
    ? { lat: confirmed.lat, lng: confirmed.lng }
    : selected?.center || compare?.current.center || grid?.center || previewCenter
  const points = useMemo(() => {
    if (comparedPoints) return comparedPoints
    const keyword = activeKeyword || selected?.keywords[0] || keywordDraft.trim() || ""
    const scanMatches =
      Boolean(grid) &&
      grid!.gridSize === gridSize &&
      Math.abs(grid!.spacingMiles - spacingMiles) < 1e-6 &&
      (grid!.pinSource ?? "grid") === pinSource
    if (scanMatches && grid) {
      if (!activeKeyword) return grid.points
      const keyed = grid.points.filter((point) => point.keyword.toLowerCase() === activeKeyword.toLowerCase())
      return keyed.length > 0 ? keyed : grid.points
    }
    if (!mapCenter || !confirmed) return []
    if (pinSource === "city_gps" && cityGpsPreview && cityGpsPreview.length > 0) {
      return cityGpsPreview.map((point) => ({
        ...point,
        keyword,
        rank: null,
        listingTitle: null,
        rating: null,
        address: null,
        mapsUrl: null,
        scannedAt: "",
        status: "unset" as const,
        error: undefined,
      }))
    }
    return buildPreviewPoints(mapCenter, gridSize, spacingMiles, keyword)
  }, [comparedPoints, grid, activeKeyword, gridSize, spacingMiles, pinSource, cityGpsPreview, mapCenter, selected?.keywords, keywordDraft, confirmed])

  function applyCampaign(campaign: Campaign | null) {
    if (!campaign) {
      setQuery(emptyQuery())
      setConfirmed(null)
      setActiveKeyword("")
      setKeywordDraft("")
      setTrafficKeywordDraft("")
      setGridSize(5)
      setSpacingMiles(1)
      setPinSource("grid")
      setCityGpsPreview(null)
      setUsedCityGps(false)
      setPreviewCenter(null)
      setSelectedPinIds([])
      setSelectedKeywords([])
      setSearchCount(DEFAULT_TRAFFIC_SEARCHES)
      setScanScheduleDraft(emptyScanSchedule())
      setTrafficScheduleDraft(emptyTrafficSchedule())
      return
    }
    setQuery(searchQueryFromCampaign(campaign))
    setConfirmed(confirmedListingFromCampaign(campaign))
    setActiveKeyword(campaign.lastGridScan?.keyword || campaign.keywords[0] || "")
    setKeywordDraft(formatKeywordText(campaign.keywords))
    setTrafficKeywordDraft("")
    setGridSize(campaign.gridSize ?? 5)
    setSpacingMiles(campaign.spacingMiles ?? 1)
    setPinSource(campaign.pinSource === "city_gps" ? "city_gps" : "grid")
    setUsedCityGps(Boolean(campaign.lastGridScan?.usedCityGps))
    setPreviewCenter(campaign.center || campaign.lastGridScan?.center || null)
    setSelectedPinIds(campaign.trafficSchedule?.lastSelectedPinIds ?? [])
    const listed = listedTrafficKeywords(campaign)
    const remembered = campaign.trafficSchedule?.lastSelectedKeywords ?? []
    setSelectedKeywords(remembered.length ? selectedKeywordsInListedOrder(listed, remembered) : listed)
    setSearchCount(normalizeTrafficSearches(campaign.trafficSchedule?.lastSearchCount))
    setScanScheduleDraft(campaign.scanSchedule ?? emptyScanSchedule())
    setTrafficScheduleDraft(campaign.trafficSchedule ?? emptyTrafficSchedule())
  }

  async function refreshScans(campaignId: string) {
    try {
      const payload = await loadCampaignScans(campaignId)
      const rows = payload.scans
      setScans(rows)
      if (rows.length >= 2) {
        setCompareToId((current) => current || rows[0]!.id)
        setCompareFromId((current) => current || rows[1]!.id)
      } else if (rows.length === 1) {
        setCompareToId(rows[0]!.id)
        setCompareFromId("")
      } else {
        setCompareToId("")
        setCompareFromId("")
        setCompare(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load scan history.")
    }
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
    if (next) void refreshScans(next.id)
    else {
      setScans([])
      setCompare(null)
    }
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
        if (next) void refreshScans(next.id)
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
    let active = true
    void loadAccount()
      .then((account) => {
        if (active) setOwnedListings(account.listings ?? [])
      })
      .catch(() => {
        if (active) setOwnedListings([])
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
    if (!confirmed) {
      setCityGpsPreview(null)
      setUsedCityGps(false)
      return
    }
    if (pinSource !== "city_gps") {
      setCityGpsPreview(null)
      setUsedCityGps(false)
      return
    }
    let active = true
    void previewGeoPoints({
      city: confirmed.city || query.city,
      state: confirmed.state || query.state,
      lat: confirmed.lat,
      lng: confirmed.lng,
      gridSize,
      spacingMiles,
      pinSource: "city_gps",
    })
      .then((payload) => {
        if (!active) return
        setCityGpsPreview(payload.points)
        setUsedCityGps(payload.usedCityGps)
      })
      .catch(() => {
        if (!active) return
        setCityGpsPreview(null)
        setUsedCityGps(false)
      })
    return () => {
      active = false
    }
  }, [confirmed, query.city, query.state, gridSize, spacingMiles, pinSource])

  useEffect(() => {
    if (!selectedPoint) return
    const next = points.find((point) => point.row === selectedPoint.row && point.col === selectedPoint.col)
    if (!next) setSelectedPoint(null)
    else if (next !== selectedPoint) setSelectedPoint(next)
  }, [points, selectedPoint])

  useEffect(() => {
    const allowed = new Set(points.map((point) => gridPinId(point)))
    setSelectedPinIds((current) => {
      const next = current.filter((id) => allowed.has(id))
      return next.length === current.length ? current : next
    })
  }, [points])

  useEffect(() => {
    const listed = listedTrafficKeywords(selected)
    setSelectedKeywords((current) => {
      if (listed.length === 0) return current.length === 0 ? current : []
      const next = selectedKeywordsInListedOrder(listed, current.length ? current : listed)
      if (next.length === current.length && next.every((keyword, index) => keyword === current[index])) return current
      return next
    })
  }, [selected?.id, selected?.keywords, selected?.lastGridScan?.keyword, selected?.businessName])

  useEffect(() => {
    if (!scanning || !selectedId) return
    let active = true
    const poll = async () => {
      try {
        const payload = await loadCampaign(selectedId)
        if (!active) return
        replaceCampaign(payload.campaign)
      } catch {
        // Keep the in-progress pin statuses if a poll fails.
      }
    }
    const timer = window.setInterval(() => {
      void poll()
    }, 1200)
    void poll()
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [scanning, selectedId])

  useEffect(() => {
    if (!selected?.id || selected.lastTrafficJob?.status !== "running") return
    let active = true
    const poll = async () => {
      try {
        const payload = await loadCampaignTraffic(selected.id)
        if (!active) return
        replaceCampaign(payload.campaign)
        setTrafficPollError(null)
        const job = payload.traffic
        if (job && job.status !== "running") {
          if (job.status === "stopped") {
            setNotice("Traffic stopped. Remaining keyword and pin pairs were cancelled.")
          } else if (job.sessionsAttempted > 0) {
            setNotice(`Traffic finished. ${job.sessionsOk} of ${job.sessionsAttempted} sessions opened the listing.`)
          }
          if (job.lastError && job.sessionsOk === 0 && job.status !== "stopped") setError(job.lastError)
        }
      } catch (err) {
        if (active) setTrafficPollError(err instanceof Error ? err.message : "Could not refresh the traffic log.")
      }
    }
    const timer = window.setInterval(() => {
      void poll()
    }, 1500)
    void poll()
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [selected?.id, selected?.lastTrafficJob?.status])

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
      setSelectedPinIds([])
      setSelectedListingId(null)
      setNotice(null)
    }
    setQuery(next)
  }

  async function onSearch() {
    setSelectedListingId(null)
    setSearching(true)
    setError(null)
    setNotice(null)
    setConfirmed(null)
    setSelectedPoint(null)
    setSelectedPinIds([])
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

  async function applyConfirmedListing(
    next: ConfirmedListing,
    persistFrom?: BusinessListing,
    queryOverride?: SearchQuery,
    ownedOverride?: DirectoryListing,
  ) {
    const usedQuery = queryOverride ?? query
    setConfirmed(next)
    setPreviewCenter({ lat: next.lat, lng: next.lng })
    setError(null)
    setNotice(`Confirmed ${next.title}. Set a keyword and grid, then scan.`)
    const owned = ownedOverride ?? ownedListings.find((row) => row.id === selectedListingId)
    if (persistFrom && owned && shouldPersistOwnedListingMatch(owned, persistFrom)) {
      try {
        const saved = await confirmListingMatch(owned.id, listingMapsMatchFromPlace(persistFrom))
        setOwnedListings((rows) => rows.map((row) => (row.id === saved.id ? saved : row)))
      } catch {
        // Tracker confirm still works if we cannot save coordinates on the listing.
      }
    }
    if (!selected || creating) return
    setSaving(true)
    try {
      replaceCampaign(
        await updateCampaign(
          selected.id,
          campaignInputFromListing(next, usedQuery, {
            keywords: selected.keywords,
            gridSize,
            spacingMiles,
            pinSource,
          }),
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the confirmed listing.")
    } finally {
      setSaving(false)
    }
  }

  async function confirmListing(listing: BusinessListing) {
    const next = confirmedListingFromSearch(listing)
    if (!next) {
      setError("That listing is missing a map location. Choose another one.")
      return
    }
    const owned = ownedListings.find((row) => row.id === selectedListingId)
    await applyConfirmedListing(next, listing, undefined, owned)
  }

  async function onPickOwnedListing(listing: DirectoryListing) {
    setSelectedListingId(listing.id)
    const nextQuery = searchQueryFromListing(listing)
    setQuery(nextQuery)
    setKeywordDraft(formatKeywordText(listing.keywords))
    if (listing.keywords[0]) setActiveKeyword(listing.keywords[0])
    setSearchResult(null)
    setSelectedPoint(null)
    setSelectedPinIds([])
    setError(null)
    setNotice(null)

    const ready = confirmedListingFromDirectory(listing)
    if (ready) {
      await applyConfirmedListing(ready, undefined, nextQuery, listing)
      setNotice(confirmedFromOwnedListingNotice(ready.title))
      return
    }

    setSearching(true)
    try {
      const payload = await searchBusiness(nextQuery, keys, Boolean(hosted?.included && !seller))
      setSearchResult(payload)
      if (listing.placeId?.trim()) {
        const match = pickMapsPlaceForListing(payload, listing)
        const confirmed = match ? confirmedListingFromSearch(match) : null
        if (match && confirmed) {
          await applyConfirmedListing(confirmed, match, nextQuery, listing)
          return
        }
        setConfirmed(null)
        setError(ownedListingLookupFailedMessage())
        return
      }
      if (payload.error && !payload.best && payload.others.length === 0) {
        setError(publicSearchMessage(payload.error) || payload.error)
      } else {
        setNotice(ownedListingNeedsConfirmMessage())
      }
    } catch (err) {
      setSearchResult(null)
      setConfirmed(null)
      setError(err instanceof Error ? err.message : ownedListingLookupFailedMessage())
    } finally {
      setSearching(false)
    }
  }

  async function persistGrid(nextSize: number, nextSpacing: number, nextSource = pinSource) {
    setGridSize(nextSize)
    setSpacingMiles(nextSpacing)
    setPinSource(nextSource)
    if (!selected || creating) return
    void updateCampaign(selected.id, { gridSize: nextSize, spacingMiles: nextSpacing, pinSource: nextSource })
      .then(replaceCampaign)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not save the grid."))
  }

  async function persistSearchCount(raw: number) {
    const value = normalizeTrafficSearches(raw)
    setSearchCount(value)
    setTrafficScheduleDraft((current) => ({ ...current, lastSearchCount: value }))
    if (!selected || creating) return
    void updateCampaign(selected.id, {
      trafficSchedule: {
        ...trafficScheduleDraft,
        lastSelectedPinIds: selectedPinIds,
        lastSelectedKeywords: selectedKeywordsInListedOrder(
          listedTrafficKeywords(selected),
          mergeKeywordLists(selectedKeywords, parseKeywordText(trafficKeywordDraft)),
        ),
        lastSearchCount: value,
      },
    })
      .then(replaceCampaign)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not save the search count."))
  }

  function parsedCampaignKeywords() {
    const parsed = parseKeywordsOrError(keywordDraft || selected?.keywords, maxKeywords)
    return parsed
  }

  async function persistKeywordList(keywords: string[]) {
    const parsed = parseKeywordsOrError(keywords, maxKeywords)
    if (parsed.error) {
      setError(parsed.error)
      return null
    }
    setKeywordDraft(formatKeywordText(parsed.keywords))
    if (!activeKeyword && parsed.keywords[0]) setActiveKeyword(parsed.keywords[0])
    setSelectedKeywords((current) => mergeKeywordLists(current, parsed.keywords).filter((keyword) =>
      parsed.keywords.some((row) => row.toLowerCase() === keyword.toLowerCase()) ||
      current.some((row) => row.toLowerCase() === keyword.toLowerCase()),
    ))
    if (!selected || creating) return parsed.keywords
    setSaving(true)
    setError(null)
    try {
      const next = await updateCampaign(selected.id, { keywords: parsed.keywords })
      replaceCampaign(next)
      setKeywordDraft(formatKeywordText(next.keywords))
      setSelectedKeywords((current) => {
        const listed = listedTrafficKeywords(next)
        return selectedKeywordsInListedOrder(listed, current.length ? mergeKeywordLists(current, next.keywords) : listed)
      })
      return next.keywords
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save those keywords.")
      return null
    } finally {
      setSaving(false)
    }
  }

  async function onRemoveKeyword(keyword: string) {
    const current = parseKeywordText(keywordDraft).length ? parseKeywordText(keywordDraft) : selected?.keywords ?? []
    const next = current.filter((row) => row.toLowerCase() !== keyword.toLowerCase())
    const saved = await persistKeywordList(next)
    if (activeKeyword.toLowerCase() === keyword.toLowerCase()) setActiveKeyword(saved?.[0] || next[0] || "")
    setSelectedKeywords((rows) => rows.filter((row) => row.toLowerCase() !== keyword.toLowerCase()))
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
    const parsed = parsedCampaignKeywords()
    if (parsed.error) {
      setError(parsed.error)
      return
    }
    const targets = parsed.keywords
    if (targets.length === 0) {
      setError("Add a keyword before scanning this business.")
      return
    }
    setScanning(true)
    setError(null)
    setNotice(null)
    setSelectedPoint(null)
    setSelectedPinIds([])
    setCompare(null)
    try {
      const hideKeys = Boolean(hosted?.included && !seller)
      let campaign = selected
      if (!campaign || creating) {
        campaign = await createCampaign(
          campaignInputFromListing(confirmed, query, {
            keywords: targets,
            gridSize,
            spacingMiles,
            pinSource,
          }),
        )
        setCreating(false)
        setSelectedId(campaign.id)
        setCampaigns((current) => [campaign!, ...current.filter((row) => row.id !== campaign!.id)])
      } else {
        campaign = await updateCampaign(
          campaign.id,
          campaignInputFromListing(confirmed, query, { keywords: targets, gridSize, spacingMiles, pinSource }),
        )
        replaceCampaign(campaign)
      }
      replaceCampaign({
        ...campaign,
        lastGridScan: {
          id: campaign.lastGridScan?.id || "running",
          campaignId: campaign.id,
          startedAt: new Date().toISOString(),
          scannedAt: new Date().toISOString(),
          keyword: targets[0]!,
          keywords: targets,
          gridSize,
          spacingMiles,
          pinSource,
          usedCityGps,
          center: { lat: confirmed.lat, lng: confirmed.lng },
          placeId: confirmed.placeId,
          pointCount: gridSearchCount(gridSize) * targets.length,
          foundCount: 0,
          points: targets.flatMap((keyword) =>
            buildPreviewPoints({ lat: confirmed.lat, lng: confirmed.lng }, gridSize, spacingMiles, keyword).map(
              (point) => ({ ...point, status: "pending" as const }),
            ),
          ),
          status: "running",
        },
      })
      let payload: Awaited<ReturnType<typeof scanCampaign>> | null = null
      try {
        payload = await scanCampaign(campaign.id, keys, hideKeys, targets)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not scan Maps."
        try {
          const latest = await loadCampaign(campaign.id)
          replaceCampaign(latest.campaign)
          const points = latest.campaign.lastGridScan?.points ?? []
          const pageError = scanGridPageError(points)
          if (pageError) {
            setError(publicPinScanMessage(pageError))
            return
          }
          if (points.some((point) => point.status === "rank" || point.status === "not_found")) {
            const found = latest.campaign.lastGridScan?.foundCount ?? 0
            const total = latest.campaign.lastGridScan?.pointCount ?? points.length
            setNotice(
              `Scan finished. ${confirmed.title} appeared at ${found} of ${total} grid points for ${scanKeywordsLabel({ keywords: targets })}.`,
            )
            return
          }
        } catch {
          // Fall through to the setup/request error.
        }
        setError(publicSearchMessage(message) || message)
        return
      }
      replaceCampaign(payload.campaign)
      setActiveKeyword(payload.grid?.keyword || targets[0] || "")
      setKeywordDraft(formatKeywordText(payload.campaign.keywords))
      await refreshScans(campaign.id)
      setCompare(null)
      const finishedPoints = payload.grid?.points ?? []
      const pageError = scanGridPageError(finishedPoints)
      if (pageError) {
        setError(publicPinScanMessage(pageError))
        return
      }
      const found = payload.grid?.foundCount ?? 0
      const total = payload.grid?.pointCount ?? 0
      setUsedCityGps(Boolean(payload.grid?.usedCityGps))
      setNotice(
        `Scan finished and saved. ${confirmed.title} appeared at ${found} of ${total} grid points for ${scanKeywordsLabel({ keywords: payload.grid?.keywords || targets })}.${
          payload.grid?.usedCityGps ? ` ${usingCityGpsBackupNote()}.` : ""
        }`,
      )
    } catch (err) {
      setError(err instanceof Error ? publicSearchMessage(err.message) || err.message : "Could not scan Maps.")
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
    setSelectedPinIds([])
    setSelectedListingId(null)
    setScans([])
    setCompare(null)
    setError(null)
    setNotice(null)
  }

  function selectCampaign(campaign: Campaign) {
    setCreating(false)
    setSelectedId(campaign.id)
    applyCampaign(campaign)
    setSearchResult(null)
    setSelectedPoint(null)
    setSelectedListingId(null)
    setCompare(null)
    setError(null)
    setNotice(null)
    void refreshScans(campaign.id)
  }

  const mapsReady = Boolean((keys.dataforseoLogin && keys.dataforseoPassword) || hosted?.dataforseo)
  const trafficJob = selected?.lastTrafficJob ?? null
  const trafficRunning = trafficJob?.status === "running"
  const busy = Boolean(saving || scanning || searching || startingTraffic || stoppingTraffic || rerunning || comparing)
  const scanFinished = campaignScanFinished(selected)
  const liveScanTotal =
    scanning && grid?.points?.length ? grid.points.length : gridSearchCount(gridSize) * Math.max(1, parseKeywordText(keywordDraft).length || selected?.keywords.length || 1)
  const liveScanLabel = scanLiveStatus(
    countFinishedScanPins(scanning && grid?.points ? grid.points : points),
    liveScanTotal,
  )
  const pinsSelectable = Boolean(scanFinished && points.length > 0 && !scanning)
  const showStartTraffic = startTrafficVisible(confirmed)
  const showStopTraffic = stopTrafficVisible(trafficJob)
  const canStartTraffic = startTrafficEnabled({
    listing: confirmed,
    campaign: selected,
    scanning,
    starting: startingTraffic,
    busy,
    running: trafficRunning,
  })
  const trafficLabel = startTrafficLabel({ scanning, starting: startingTraffic, scanFinished })
  const step = searching ? 1 : confirmed ? 3 : listings.length > 0 ? 2 : 1
  const trafficLog = trafficJob?.log ?? []
  const trafficResults = trafficJob?.results ?? []
  const trafficKeywords = listedTrafficKeywords(selected)
  const typedTrafficKeywords = parseKeywordText(trafficKeywordDraft)
  const trafficKeywordPool = mergeKeywordLists(trafficKeywords, typedTrafficKeywords)
  const trafficKeywordSelection = selectedKeywordsInListedOrder(
    trafficKeywordPool,
    mergeKeywordLists(selectedKeywords, typedTrafficKeywords),
  )
  const editorKeywords = parseKeywordText(keywordDraft)
  const chipKeywords = editorKeywords.length ? editorKeywords : selected?.keywords ?? []

  function togglePin(point: GridPointResult) {
    const pinId = gridPinId(point)
    setSelectedPoint(point)
    setSelectedPinIds((current) => (current.includes(pinId) ? current.filter((id) => id !== pinId) : [...current, pinId]))
  }

  function selectAllPins() {
    setSelectedPinIds(points.map((point) => gridPinId(point)))
  }

  function selectNoPins() {
    setSelectedPinIds([])
  }

  function toggleTrafficKeyword(keyword: string) {
    setSelectedKeywords((current) =>
      current.some((row) => row.toLowerCase() === keyword.toLowerCase())
        ? current.filter((row) => row.toLowerCase() !== keyword.toLowerCase())
        : selectedKeywordsInListedOrder(trafficKeywords, [...current, keyword]),
    )
  }

  async function onStartTraffic() {
    if (!selected) return
    if (selectedPinIds.length === 0) {
      window.alert(noPinsSelectedMessage())
      setError(noPinsSelectedMessage())
      return
    }
    const typed = parseKeywordText(trafficKeywordDraft)
    const listed = mergeKeywordLists(trafficKeywords, typed)
    const parsed = parseKeywordsOrError(listed, maxKeywords)
    if (parsed.error) {
      setError(parsed.error)
      return
    }
    const keywords = selectedKeywordsInListedOrder(parsed.keywords, mergeKeywordLists(selectedKeywords, typed))
    if (keywords.length === 0) {
      window.alert(noKeywordsSelectedMessage())
      setError(noKeywordsSelectedMessage())
      return
    }
    if (typed.length > 0 && selected && !creating) {
      const saved = await persistKeywordList(parsed.keywords)
      if (!saved) return
    }
    const available = selectedPinIds.length * keywords.length
    const planned = plannedTrafficSearchCount(available, searchCount)
    const keywordList = keywords.map((keyword) => `“${keyword}”`).join(", then ")
    const ok = window.confirm(
      trafficStartConfirmCopy({
        pinCount: selectedPinIds.length,
        keywordCount: keywords.length,
        searches: searchCount,
        businessName: confirmed?.title || selected.businessName,
        keywordList,
      }),
    )
    if (!ok) return
    setStartingTraffic(true)
    setError(null)
    setNotice(null)
    setTrafficPollError(null)
    try {
      await persistSearchCount(searchCount)
      const payload = await startCampaignTraffic(selected.id, keys, Boolean(hosted?.included && !seller), {
        pinIds: selectedPinIds,
        keywords,
        keywordIds: keywords,
        searches: searchCount,
      })
      replaceCampaign(payload.campaign)
      setNotice(
        `Traffic started: ${planned} of ${available} searches (${selectedPinIds.length} pin${selectedPinIds.length === 1 ? "" : "s"} × ${keywords.length} keyword${keywords.length === 1 ? "" : "s"}, first pairs in listed order). Watch the live log under the map.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start traffic.")
    } finally {
      setStartingTraffic(false)
    }
  }

  async function onStopTraffic() {
    if (!selected) return
    setStoppingTraffic(true)
    setError(null)
    try {
      const payload = await stopCampaignTraffic(selected.id)
      replaceCampaign(payload.campaign)
      setNotice("Traffic stopped. Remaining keyword and pin pairs were cancelled.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stop traffic.")
    } finally {
      setStoppingTraffic(false)
    }
  }

  async function onRerunScan() {
    if (!selected) return
    const source = scans[0] || selected.lastGridScan
    if (!source) {
      setError("Finish a scan before rerunning.")
      return
    }
    setRerunning(true)
    setScanning(true)
    setError(null)
    setNotice(null)
    try {
      if (source.gridSize) setGridSize(source.gridSize)
      if (source.spacingMiles) setSpacingMiles(source.spacingMiles)
      const rerunKeywords = source.keywords?.length ? source.keywords : source.keyword ? [source.keyword] : undefined
      if (rerunKeywords?.[0]) setActiveKeyword(rerunKeywords[0])
      const payload = await rerunCampaignScan(selected.id, keys, Boolean(hosted?.included && !seller), rerunKeywords)
      replaceCampaign(payload.campaign)
      await refreshScans(selected.id)
      setCompare(null)
      const found = payload.grid?.foundCount ?? 0
      const total = payload.grid?.pointCount ?? 0
      setNotice(
        `Rerun saved. ${found} of ${total} grid points found ${scanKeywordsLabel({ keywords: payload.grid?.keywords, keyword: payload.grid?.keyword || source.keyword })}.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rerun that scan.")
    } finally {
      setRerunning(false)
      setScanning(false)
    }
  }

  async function onCompareScans(fromId = compareFromId, toId = compareToId) {
    if (!selected) return
    const previousId = fromId || scans[1]?.id
    const currentId = toId || scans[0]?.id
    if (!previousId || !currentId) {
      setError("Save two scans before comparing.")
      return
    }
    setComparing(true)
    setError(null)
    try {
      const result = await compareCampaignScans(selected.id, previousId, currentId)
      setCompare(result)
      setCompareFromId(previousId)
      setCompareToId(currentId)
      setNotice(
        `Compared ${scanWhen(result.previous)} with ${scanWhen(result.current)}. ${result.improved} improved, ${result.worse} worse, ${result.added} new, ${result.lost} lost.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not compare those scans.")
    } finally {
      setComparing(false)
    }
  }

  async function onSaveSchedules() {
    if (!selected) return
    if ((scanScheduleDraft.enabled || trafficScheduleDraft.enabled) && !confirmed) {
      setError("Confirm a Maps listing before scheduling scans or traffic.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      const utcOffsetMinutes = -new Date().getTimezoneOffset()
      const next = await updateCampaign(selected.id, {
        scanSchedule: {
          ...scanScheduleDraft,
          utcOffsetMinutes: scanScheduleDraft.timeZone === "local" ? utcOffsetMinutes : undefined,
        },
        trafficSchedule: {
          ...trafficScheduleDraft,
          utcOffsetMinutes: trafficScheduleDraft.timeZone === "local" ? utcOffsetMinutes : undefined,
          lastSelectedPinIds: selectedPinIds,
          lastSelectedKeywords: selectedKeywordsInListedOrder(
            listedTrafficKeywords(selected),
            mergeKeywordLists(selectedKeywords, parseKeywordText(trafficKeywordDraft)),
          ),
        },
      })
      replaceCampaign(next)
      setScanScheduleDraft(next.scanSchedule ?? scanScheduleDraft)
      setTrafficScheduleDraft(next.trafficSchedule ?? trafficScheduleDraft)
      setNotice("Schedules saved. This server checks every minute. One web replica is enough; extra copies would run the same job twice.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save schedules.")
    } finally {
      setSaving(false)
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
          {ownedListings.length > 0
            ? "Pick one of your listings, or search Maps, then scan ranks around it."
            : "Search for the business, click the right Maps listing, then scan ranks around it."}
        </p>
        {campaigns.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-sm text-muted">
            {ownedListings.length > 0
              ? "No campaigns yet. Pick one of your businesses or search, confirm the listing, then scan."
              : "No campaigns yet. Search a business, confirm the listing, then scan."}
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
                {confirmed
                  ? confirmed.title
                  : selected && !creating
                    ? selected.name
                    : ownedListings.length > 0
                      ? "Pick a listing, or search"
                      : "Search, confirm, then scan"}
              </h3>
              <p className="mt-1 text-sm text-muted">
                {confirmed
                  ? confirmed.address
                  : ownedListings.length > 0
                    ? "Choose one of your PlaceFind listings, or search Maps for a different business."
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
              {
                n: 1,
                label: ownedListings.length > 0 ? "Pick or search" : "Search",
                detail: ownedListings.length > 0 ? "Your listing or a Maps search" : "Name, city, and state",
              },
              { n: 2, label: "Confirm", detail: "Click the right listing" },
              { n: 3, label: "Scan business", detail: "Keywords and grid" },
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

          {ownedListings.length > 0 && (
            <div className="mt-6" data-testid="owned-listings">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Your businesses</p>
              <p className="mt-1 text-sm text-muted">
                Pick a listing you already created. If it has a Maps match, we confirm it here so you can scan without
                searching again.
              </p>
              <ul className="mt-3 grid gap-2">
                {ownedListings.map((listing) => {
                  const picked = selectedListingId === listing.id
                  return (
                    <li key={listing.id}>
                      <button
                        type="button"
                        data-testid={`owned-listing-${listing.id}`}
                        disabled={busy}
                        onClick={() => void onPickOwnedListing(listing)}
                        className={`w-full rounded-xl border px-4 py-3 text-left ${picked ? "border-brass bg-brass/10" : "border-line bg-ink hover:border-brass/60"}`}
                      >
                        <span className="block font-display text-xl text-paper">{listing.name}</span>
                        <span className="mt-1 block text-sm text-muted">{listingLocation(listing)}</span>
                        <span className="mt-1 block text-xs text-muted">{ownedListingTrackHint(listing)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <form
            className="mt-6 grid gap-4"
            onSubmit={(event: FormEvent) => {
              event.preventDefault()
              void onSearch()
            }}
          >
            {ownedListings.length > 0 && (
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                Or search a different business
              </p>
            )}
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
            <CityStateFields
              city={query.city}
              state={query.state}
              onCity={(city) => onQueryChange({ ...query, city })}
              onState={(state) => onQueryChange({ ...query, state })}
              fieldClassName="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none placeholder:text-muted/50 focus:border-brass"
            />
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
          <section id="traffic" className="rounded-2xl border border-line bg-panel p-5 sm:p-6">
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
              <div className="flex flex-wrap items-end gap-2">
                <button
                  type="button"
                  onClick={() => void onScan()}
                  disabled={busy || !canScan}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
                >
                  {scanning && <LoaderCircle className="h-4 w-4 animate-spin" />}
                  {scanning ? liveScanLabel : "Scan business"}
                </button>
                {showStartTraffic && (
                  <label className="grid gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Searches</span>
                    <input
                      type="number"
                      data-testid="traffic-searches"
                      min={1}
                      max={MAX_TRAFFIC_SEARCHES}
                      step={1}
                      value={searchCount}
                      onChange={(event) => {
                        const next = Number(event.target.value)
                        if (!Number.isInteger(next)) return
                        const value = Math.min(MAX_TRAFFIC_SEARCHES, Math.max(1, next))
                        setSearchCount(value)
                        setTrafficScheduleDraft((current) => ({ ...current, lastSearchCount: value }))
                      }}
                      onBlur={() => void persistSearchCount(searchCount)}
                      disabled={busy}
                      className="h-11 w-20 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
                      aria-describedby="traffic-searches-help"
                    />
                  </label>
                )}
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
                {showStopTraffic && (
                  <button
                    type="button"
                    data-testid="stop-traffic"
                    onClick={() => void onStopTraffic()}
                    disabled={stoppingTraffic}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-clay/50 bg-clay/10 px-4 font-semibold text-clay hover:bg-clay/20 disabled:opacity-60"
                  >
                    {stoppingTraffic && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    {stoppingTraffic ? "Stopping…" : "Stop Traffic"}
                  </button>
                )}
              </div>
            </div>

            {showStartTraffic && (
              <p id="traffic-searches-help" className="mt-3 text-sm text-muted">
                {trafficSearchHelpCopy()}{" "}
                {trafficKeywordSelection.length > 0 && selectedPinIds.length > 0
                  ? `This run will do ${plannedTrafficSearchCount(selectedPinIds.length * trafficKeywordSelection.length, searchCount)} of ${selectedPinIds.length * trafficKeywordSelection.length} pin/keyword pairs.`
                  : "Select pins and keywords first."}
              </p>
            )}
            {!mapsReady && (
              <p className="mt-4 rounded-xl border border-clay/40 px-4 py-3 text-sm text-clay">
                {seller ? mapsKeysMissingAdminMessage() : "Maps rank tracking is not ready on this copy yet."}
              </p>
            )}
            {mapsReady && (
              <p className="mt-4 rounded-xl border border-brass/25 bg-brass/5 px-4 py-3 text-sm text-paper/80">
                A {gridSize}×{gridSize} scan runs {gridSearchCount(gridSize) * Math.max(1, chipKeywords.length)} paid Maps
                searches
                {chipKeywords.length > 1
                  ? ` — ${gridSearchCount(gridSize)} points × ${chipKeywords.length} keywords.`
                  : " — one for each grid point, from that point’s coordinates."}{" "}
                A 7×7 scan is {49 * Math.max(1, chipKeywords.length)} paid searches
                {chipKeywords.length > 1 ? ` for ${chipKeywords.length} keywords.` : "."}
                {desktop ? " Larger grids take a few minutes." : ""}
              </p>
            )}

            <label className="mt-4 grid gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Keywords</span>
              <textarea
                data-testid="scan-keywords"
                value={keywordDraft}
                onChange={(event) => {
                  setKeywordDraft(event.target.value)
                  const parsed = parseKeywordText(event.target.value)
                  if (parsed[0] && !parsed.some((row) => row.toLowerCase() === activeKeyword.toLowerCase())) {
                    setActiveKeyword(parsed[0])
                  }
                }}
                onBlur={() => {
                  const parsed = parsedCampaignKeywords()
                  if (parsed.error) {
                    setError(parsed.error)
                    return
                  }
                  if (!selected || creating) return
                  if (parsed.keywords.join("\0") === selected.keywords.join("\0")) return
                  void persistKeywordList(parsed.keywords)
                }}
                placeholder="barbecue, brisket, smoked meats"
                rows={3}
                autoComplete="off"
                disabled={busy}
                className="min-h-[5.5rem] w-full rounded-lg border border-line bg-ink px-3 py-2 text-paper outline-none placeholder:text-muted/50 focus:border-brass"
              />
              <span className="text-xs text-muted">{keywordHelpCopy(maxKeywords)}</span>
            </label>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
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

            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Scan points</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void persistGrid(gridSize, spacingMiles, "grid")}
                  className={`rounded-xl border px-4 py-3 text-left ${pinSource === "grid" ? "border-brass bg-brass/10 text-paper" : "border-line bg-ink text-paper/80"}`}
                >
                  <span className="block text-sm font-semibold">Grid around listing</span>
                  <span className="mt-1 block text-xs text-muted">Even 3×3 / 5×5 / 7×7 around the confirmed pin.</span>
                </button>
                <button
                  type="button"
                  onClick={() => void persistGrid(gridSize, spacingMiles, "city_gps")}
                  className={`rounded-xl border px-4 py-3 text-left ${pinSource === "city_gps" ? "border-brass bg-brass/10 text-paper" : "border-line bg-ink text-paper/80"}`}
                >
                  <span className="block text-sm font-semibold">City GPS backup</span>
                  <span className="mt-1 block text-xs text-muted">Nearest city GPS points around the listing, same size.</span>
                </button>
              </div>
              {pinSource === "city_gps" && usedCityGps && (
                <p className="mt-3 rounded-xl border border-brass/25 bg-brass/5 px-4 py-3 text-sm text-paper/80">
                  {usingCityGpsBackupNote()}
                </p>
              )}
              {pinSource === "city_gps" && !usedCityGps && (
                <p className="mt-3 text-sm text-muted">
                  No city GPS points for this city yet. Upload a US city GPS CSV in Admin, or keep using the grid around
                  the listing.
                </p>
              )}
            </div>

            {chipKeywords.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {chipKeywords.map((keyword) => {
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

            {showStartTraffic && (
              <div className="mt-5 rounded-xl border border-brass/25 bg-brass/5 px-4 py-4" data-testid="traffic-keyword-panel">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Start Traffic keywords</p>
                <p className="mt-2 text-sm text-paper/80">{trafficKeywordHelpCopy()}</p>
                <label className="mt-3 grid gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Type keywords</span>
                  <textarea
                    data-testid="traffic-keywords"
                    value={trafficKeywordDraft}
                    onChange={(event) => setTrafficKeywordDraft(event.target.value)}
                    placeholder="Add more: ribs, sliced brisket"
                    rows={2}
                    autoComplete="off"
                    disabled={busy}
                    className="min-h-[4rem] w-full rounded-lg border border-line bg-ink px-3 py-2 text-paper outline-none placeholder:text-muted/50 focus:border-brass"
                  />
                  <span className="text-xs text-muted">{trafficKeywordTypeHelpCopy()}</span>
                </label>
                {trafficKeywordPool.length > 0 && (
                  <ul className="mt-3 grid gap-2">
                    {trafficKeywordPool.map((keyword) => {
                      const checked = trafficKeywordSelection.some((row) => row.toLowerCase() === keyword.toLowerCase())
                      return (
                        <li key={keyword}>
                          <label className="flex items-start gap-3 text-sm text-paper">
                            <input
                              type="checkbox"
                              data-testid={`traffic-keyword-${keyword}`}
                              checked={checked}
                              onChange={() => toggleTrafficKeyword(keyword)}
                              className="mt-0.5 h-4 w-4 accent-[#c9a227]"
                            />
                            <span>
                              <span className="font-semibold">{keyword}</span>
                              <span className="mt-0.5 block text-xs text-muted">
                                Search this keyword on Maps from each selected pin GPS, then open the confirmed listing when it appears.
                              </span>
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
                <p className="mt-3 text-xs text-muted">
                  Selected keywords run in listed order for each selected pin
                  {trafficKeywordSelection.length > 0 ? `: ${trafficKeywordSelection.join(" → ")}.` : "."}
                </p>
              </div>
            )}
          </section>
        )}

        {selected && !creating && confirmed && (
          <SchedulePanel
            scanSchedule={scanScheduleDraft}
            trafficSchedule={trafficScheduleDraft}
            selectedPinCount={selectedPinIds.length}
            busy={busy}
            onScanChange={setScanScheduleDraft}
            onTrafficChange={setTrafficScheduleDraft}
            onSave={() => void onSaveSchedules()}
          />
        )}

        <section className="overflow-hidden rounded-2xl border border-line bg-panel p-0 sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 px-5 pt-5 sm:px-0 sm:pt-0">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Map grid</p>
              <h4 className="font-display text-2xl text-paper">Where the listing ranks</h4>
              <p className="mt-1 text-sm text-muted">
                {confirmed
                  ? `Pins mark every ${gridSize}×${gridSize} search point around ${confirmed.title}. Rank 1 is the darkest green, then 2 and 3 in lighter greens; 4–6 yellow, 7–10 orange, 11–15 orange-red, and 16+ or not found in red.${
                      usedCityGps || grid?.usedCityGps ? ` ${usingCityGpsBackupNote()}.` : ""
                    }`
                  : "Confirm a listing to drop a pin and center the grid on that business."}
                {pinsSelectable
                  ? " After a scan, click pins to choose which GPS points get traffic."
                  : ""}
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
              {compare && (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: rankChangeColor("up") }} />
                    Improved / new
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: rankChangeColor("down") }} />
                    Worse / lost
                  </span>
                </>
              )}
            </div>
          </div>

          {scanning && (
            <div className="mx-5 mb-3 flex items-center gap-2 rounded-xl border border-brass/25 bg-brass/5 px-4 py-2 text-sm text-paper/80 sm:mx-0">
              <LoaderCircle className="h-4 w-4 animate-spin text-brass" />
              {liveScanLabel}
            </div>
          )}

          {pinsSelectable && (
            <div className="mx-5 mb-3 flex flex-wrap items-center gap-2 sm:mx-0">
              <p className="text-sm text-paper/80">
                {selectedPinIds.length} of {points.length} pin{points.length === 1 ? "" : "s"} selected for traffic
              </p>
              <button
                type="button"
                data-testid="select-all-pins"
                onClick={selectAllPins}
                className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-xs font-semibold text-paper hover:border-brass"
              >
                Select all
              </button>
              <button
                type="button"
                data-testid="select-none-pins"
                onClick={selectNoPins}
                className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-xs font-semibold text-paper hover:border-brass"
              >
                Select none
              </button>
            </div>
          )}

          <GridMap
            center={mapCenter}
            points={points}
            selected={selectedPoint}
            selectedPinIds={selectedPinIds}
            pinSelectable={pinsSelectable}
            targetName={confirmed?.title || selected?.listingTitle || selected?.businessName || ""}
            gridSize={grid?.gridSize || gridSize}
            onSelect={setSelectedPoint}
            onTogglePin={togglePin}
          />

          <TrafficLivePanel
            job={trafficJob}
            log={trafficLog}
            results={trafficResults}
            running={trafficRunning}
            starting={startingTraffic}
            pollError={trafficPollError}
          />

          {selectedPoint && (
            <div className="mx-5 mt-4 rounded-xl border border-line bg-ink px-4 py-3 sm:mx-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Selected pin</p>
              <p className="mt-1 text-sm text-paper">
                {gridPinLabel(selectedPoint, grid?.gridSize || gridSize)} · {selectedPoint.lat.toFixed(5)},{" "}
                {selectedPoint.lng.toFixed(5)}
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
              {selectedPoint.change && (
                <p className="mt-2 text-sm" style={{ color: rankChangeColor(selectedPoint.change) }}>
                  {rankChangeLabel(selectedPoint.change)}
                  {selectedPoint.previousRank != null ? ` · was #${selectedPoint.previousRank}` : ""}
                  {selectedPoint.rank != null ? ` · now #${selectedPoint.rank}` : " · now not found"}
                </p>
              )}
              {pinsSelectable && (
                <p className="mt-2 text-xs text-brass">
                  {selectedPinIds.includes(gridPinId(selectedPoint))
                    ? "Selected for traffic from this GPS point."
                    : "Not selected for traffic. Click the pin again to add it."}
                </p>
              )}
              <p className="mt-1 text-xs text-muted">
                {selectedPoint.locationCoordinate || `${selectedPoint.lat.toFixed(5)},${selectedPoint.lng.toFixed(5)}`}
                {" · "}
                {formatWhen(selectedPoint.scannedAt)}
              </p>
              {selectedPoint.error && (
                <p className="mt-2 text-sm text-clay">{publicPinScanMessage(selectedPoint.error)}</p>
              )}
            </div>
          )}

          {points.length > 0 && (
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
                      className={`cursor-pointer border-t border-line hover:bg-raised/60 ${selectedPinIds.includes(gridPinId(point)) ? "bg-brass/5" : ""}`}
                      onClick={() => (pinsSelectable ? togglePin(point) : setSelectedPoint(point))}
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

          {(grid || campaignScanFinished(selected)) && (
            <CompetitorsPanel
              ownTitle={grid?.ownGeo?.title || confirmed?.title || selected?.listingTitle || ""}
              ownGeo={grid?.ownGeo ?? null}
              nearbyCityCount={grid?.nearbyCities?.length ?? 0}
              pinCompetitors={selectedPoint?.competitors}
              allCompetitors={grid?.competitors?.length ? grid.competitors : rollupCompetitors(grid?.points ?? [])}
              geoOnly={competitorsGeoOnly}
              scope={selectedPoint?.competitors?.length ? competitorsScope : "all"}
              pinAvailable={Boolean(selectedPoint?.competitors?.length)}
              onGeoOnly={setCompetitorsGeoOnly}
              onScope={setCompetitorsScope}
            />
          )}

          <ScanHistoryPanel
            scans={scans}
            compare={compare}
            compareFromId={compareFromId}
            compareToId={compareToId}
            comparing={comparing}
            rerunning={rerunning}
            busy={busy}
            onCompareFrom={setCompareFromId}
            onCompareTo={setCompareToId}
            onCompare={() => void onCompareScans()}
            onLatestVsPrevious={() => {
              if (scans.length < 2) return
              void onCompareScans(scans[1]!.id, scans[0]!.id)
            }}
            onClearCompare={() => setCompare(null)}
            onRerun={() => void onRerunScan()}
          />
        </section>
      </main>
    </div>
  )
}

function geoMark(label: string, on: boolean) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
        on ? "bg-brass/15 text-brass" : "bg-raised text-muted"
      }`}
    >
      {label}
    </span>
  )
}

function CompetitorsPanel({
  ownTitle,
  ownGeo,
  nearbyCityCount,
  pinCompetitors,
  allCompetitors,
  geoOnly,
  scope,
  pinAvailable,
  onGeoOnly,
  onScope,
}: {
  ownTitle: string
  ownGeo: OwnGeoFlags | null
  nearbyCityCount: number
  pinCompetitors?: CompetitorListing[]
  allCompetitors: CompetitorListing[]
  geoOnly: boolean
  scope: "all" | "pin"
  pinAvailable: boolean
  onGeoOnly: (value: boolean) => void
  onScope: (value: "all" | "pin") => void
}) {
  const rows = filterCompetitors(scope === "pin" && pinAvailable ? pinCompetitors : allCompetitors, geoOnly)
  const ownHits = ownGeo?.geoCities ?? []
  return (
    <div className="mx-5 mt-6 rounded-xl border border-line bg-ink px-4 py-4 sm:mx-0" data-testid="competitors-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Competitors</p>
          <h5 className="font-display text-xl text-paper">Other Maps listings at these pins</h5>
          <p className="mt-1 text-sm text-muted">
            Names are checked against {nearbyCityCount || "nearby"} cities within 50 miles, plus the state name and
            abbreviation.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-paper/80">
          <input
            type="checkbox"
            data-testid="competitors-geo-filter"
            checked={geoOnly}
            onChange={(event) => onGeoOnly(event.target.checked)}
            className="h-4 w-4 accent-brass"
          />
          {competitorsGeoFilterLabel()}
        </label>
      </div>

      {ownTitle && (
        <p className="mt-3 text-sm text-paper/80" data-testid="own-geo-flags">
          {ownHits.length || ownGeo?.usesStateName || ownGeo?.usesStateAbbr
            ? `${ownTitle} uses ${[
                ...ownHits,
                ownGeo?.usesStateName ? "the state name" : "",
                ownGeo?.usesStateAbbr ? "the state abbreviation" : "",
              ]
                .filter(Boolean)
                .join(", ")} in its name.`
            : `${ownTitle} does not use a nearby city or state name.`}
        </p>
      )}

      {pinAvailable && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onScope("all")}
            className={`inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold ${
              scope === "all" ? "border-brass text-brass" : "border-line text-paper hover:border-brass"
            }`}
          >
            All pins
          </button>
          <button
            type="button"
            onClick={() => onScope("pin")}
            className={`inline-flex h-8 items-center rounded-lg border px-3 text-xs font-semibold ${
              scope === "pin" ? "border-brass text-brass" : "border-line text-paper hover:border-brass"
            }`}
          >
            This pin
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          {geoOnly ? "No listings in this set use a nearby city or state name." : "No competitor listings stored for this scan yet."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="pb-3 pr-3 font-semibold">Name</th>
                <th className="pb-3 pr-3 font-semibold">Rank</th>
                <th className="pb-3 pr-3 font-semibold">Rating</th>
                <th className="pb-3 pr-3 font-semibold">Geo cities</th>
                <th className="pb-3 font-semibold">State</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.placeId || row.title}-${row.rank}`} className="border-t border-line">
                  <td className="py-2.5 pr-3 text-paper/80">
                    {row.title}
                    {row.address && <span className="block text-xs text-muted">{row.address}</span>}
                  </td>
                  <td className="py-2.5 pr-3 text-paper">#{row.rank}</td>
                  <td className="py-2.5 pr-3 text-paper/80">{row.rating != null ? row.rating.toFixed(1) : "—"}</td>
                  <td className="py-2.5 pr-3 text-paper/80">{row.geoCities.length ? row.geoCities.join(", ") : "—"}</td>
                  <td className="py-2.5">
                    <span className="inline-flex flex-wrap gap-1">
                      {geoMark("Name", row.usesStateName)}
                      {geoMark("Abbr", row.usesStateAbbr)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TrafficLivePanel({
  job,
  log,
  results,
  running,
  starting,
  pollError,
}: {
  job: TrafficJob | null
  log: TrafficLogLine[]
  results: TrafficPinResult[]
  running: boolean
  starting: boolean
  pollError: string | null
}) {
  return (
    <div className="mx-5 mt-4 rounded-xl border border-line bg-ink px-4 py-4 sm:mx-0" data-testid="traffic-live-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Live traffic log</p>
          <h5 className="font-display text-xl text-paper">Sessions from selected pins</h5>
        </div>
        {job && (
          <p className="text-xs text-muted">
            {trafficPinStatusLabel(job.status)}
            {job.sessionsRequested ? ` · ${job.sessionsOk}/${job.sessionsRequested} opened` : ""}
          </p>
        )}
      </div>

      {pollError && <p className="mt-3 text-sm text-clay">{pollError}</p>}
      {job?.lastError && job.sessionsOk === 0 && job.status !== "stopped" && (
        <p className="mt-3 text-sm text-clay">{job.lastError}</p>
      )}

      {(starting || running) && log.length === 0 && (
        <div className="mt-3 flex items-center gap-2 text-sm text-paper/80">
          <LoaderCircle className="h-4 w-4 animate-spin text-brass" />
          {trafficLogLoadingCopy()}
        </div>
      )}

      {!job && !starting && (
        <p className="mt-3 text-sm text-muted">{trafficLogEmptyCopy()}</p>
      )}

      {log.length > 0 && (
        <ol className="mt-3 max-h-48 overflow-auto rounded-lg border border-line bg-panel/40 px-3 py-2" data-testid="traffic-log">
          {log.map((line, index) => (
            <li key={`${line.at}-${index}`} className="border-b border-line/70 py-1.5 text-sm last:border-b-0">
              <span className="block text-[11px] text-muted">{formatWhen(line.at)}</span>
              <span className="text-paper/85">{line.message}</span>
            </li>
          ))}
        </ol>
      )}

      {results.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm" data-testid="traffic-results">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="pb-2 pr-3 font-semibold">Pin</th>
                <th className="pb-2 pr-3 font-semibold">Keyword</th>
                <th className="pb-2 pr-3 font-semibold">Coordinate</th>
                <th className="pb-2 pr-3 font-semibold">Status</th>
                <th className="pb-2 font-semibold">When</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={`${row.pinId}-${row.keyword || ""}`} className="border-t border-line">
                  <td className="py-2 pr-3 text-paper">
                    R{row.row + 1} C{row.col + 1}
                  </td>
                  <td className="py-2 pr-3 text-paper/80">{row.keyword || "—"}</td>
                  <td className="py-2 pr-3 text-muted">
                    {row.lat.toFixed(5)}, {row.lng.toFixed(5)}
                  </td>
                  <td className="py-2 pr-3 text-paper/80">{trafficPinStatusLabel(row.status)}</td>
                  <td className="py-2 text-muted">
                    {row.finishedAt ? formatWhen(row.finishedAt) : row.status === "running" || row.status === "pending" ? "In progress" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ScanHistoryPanel({
  scans,
  compare,
  compareFromId,
  compareToId,
  comparing,
  rerunning,
  busy,
  onCompareFrom,
  onCompareTo,
  onCompare,
  onLatestVsPrevious,
  onClearCompare,
  onRerun,
}: {
  scans: GridScanRun[]
  compare: ScanCompare | null
  compareFromId: string
  compareToId: string
  comparing: boolean
  rerunning: boolean
  busy: boolean
  onCompareFrom: (id: string) => void
  onCompareTo: (id: string) => void
  onCompare: () => void
  onLatestVsPrevious: () => void
  onClearCompare: () => void
  onRerun: () => void
}) {
  return (
    <div className="mt-6 border-t border-line px-5 pt-4 sm:px-0" data-testid="scan-history">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Scan history</p>
          <h5 className="font-display text-xl text-paper">Saved grid scans</h5>
          <p className="mt-1 text-sm text-muted">Every finished scan is kept. Rerun uses the same keyword, grid, and center.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="rerun-scan"
            onClick={onRerun}
            disabled={busy || scans.length === 0}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-paper hover:border-brass disabled:opacity-60"
          >
            {(rerunning || comparing) && <LoaderCircle className="h-4 w-4 animate-spin" />}
            Rerun
          </button>
          <button
            type="button"
            data-testid="compare-latest"
            onClick={onLatestVsPrevious}
            disabled={busy || scans.length < 2}
            className="inline-flex h-9 items-center rounded-lg border border-line px-3 text-sm font-semibold text-paper hover:border-brass disabled:opacity-60"
          >
            Latest vs previous
          </button>
        </div>
      </div>

      {scans.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No saved scans yet. Scan the confirmed listing to create the first snapshot.</p>
      ) : (
        <ul className="mt-3 grid gap-1 text-sm text-muted" data-testid="scan-history-list">
          {scans.map((run) => (
            <li key={run.id}>
              {scanWhen(run)} · {run.keyword} · {run.gridSize}×{run.gridSize} · {run.foundCount} of {run.pointCount} found
            </li>
          ))}
        </ul>
      )}

      {scans.length >= 2 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Earlier scan</span>
            <select
              value={compareFromId}
              onChange={(event) => onCompareFrom(event.target.value)}
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            >
              {scans.map((run) => (
                <option key={run.id} value={run.id}>
                  {scanWhen(run)} · {run.keyword}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Later scan</span>
            <select
              value={compareToId}
              onChange={(event) => onCompareTo(event.target.value)}
              className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
            >
              {scans.map((run) => (
                <option key={run.id} value={run.id}>
                  {scanWhen(run)} · {run.keyword}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <button
              type="button"
              data-testid="compare-scans"
              onClick={onCompare}
              disabled={busy || !compareFromId || !compareToId}
              className="inline-flex h-11 items-center rounded-lg bg-brass px-4 text-sm font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
            >
              Compare
            </button>
            {compare && (
              <button
                type="button"
                onClick={onClearCompare}
                className="inline-flex h-11 items-center rounded-lg border border-line px-3 text-sm text-paper hover:border-brass"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {compare && (
        <div className="mt-4 overflow-x-auto" data-testid="scan-compare-table">
          <p className="mb-2 text-sm text-paper/80">
            {compare.improved} improved · {compare.worse} worse · {compare.same} same · {compare.added} new · {compare.lost} lost
          </p>
          <table className="w-full min-w-[28rem] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="pb-2 pr-3 font-semibold">Pin</th>
                <th className="pb-2 pr-3 font-semibold">Earlier</th>
                <th className="pb-2 pr-3 font-semibold">Later</th>
                <th className="pb-2 font-semibold">Change</th>
              </tr>
            </thead>
            <tbody>
              {compare.pins.map((pin) => (
                <tr key={`${pin.row}-${pin.col}`} className="border-t border-line">
                  <td className="py-2 pr-3 text-muted">
                    R{pin.row + 1} C{pin.col + 1}
                  </td>
                  <td className="py-2 pr-3 text-paper/80">{pin.previousRank == null ? "—" : `#${pin.previousRank}`}</td>
                  <td className="py-2 pr-3 text-paper/80">{pin.currentRank == null ? "—" : `#${pin.currentRank}`}</td>
                  <td className="py-2 font-semibold" style={{ color: rankChangeColor(pin.change) }}>
                    {rankChangeLabel(pin.change)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ScheduleFieldset({
  title,
  detail,
  schedule,
  extra,
  onChange,
}: {
  title: string
  detail: string
  schedule: ScanSchedule
  extra?: ReactNode
  onChange: (next: ScanSchedule) => void
}) {
  return (
    <fieldset className="grid gap-3 rounded-xl border border-line bg-ink px-4 py-4">
      <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">{title}</legend>
      <p className="text-sm text-muted">{detail}</p>
      <label className="inline-flex items-center gap-2 text-sm text-paper">
        <input
          type="checkbox"
          checked={schedule.enabled}
          onChange={(event) => onChange({ ...schedule, enabled: event.target.checked })}
        />
        Run automatically
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Cadence</span>
          <select
            value={schedule.cadence}
            onChange={(event) =>
              onChange({
                ...schedule,
                cadence: event.target.value === "weekly" ? "weekly" : "daily",
                weekday: event.target.value === "weekly" ? (schedule.weekday ?? 1) : undefined,
              })
            }
            className="h-11 rounded-lg border border-line bg-panel px-3 text-paper outline-none focus:border-brass"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </label>
        {schedule.cadence === "weekly" && (
          <label className="grid gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Weekday</span>
            <select
              value={schedule.weekday ?? 1}
              onChange={(event) => onChange({ ...schedule, weekday: Number(event.target.value) })}
              className="h-11 rounded-lg border border-line bg-panel px-3 text-paper outline-none focus:border-brass"
            >
              {WEEKDAYS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Hour</span>
          <select
            value={schedule.hour}
            onChange={(event) => onChange({ ...schedule, hour: Number(event.target.value) })}
            className="h-11 rounded-lg border border-line bg-panel px-3 text-paper outline-none focus:border-brass"
          >
            {Array.from({ length: 24 }, (_, hour) => (
              <option key={hour} value={hour}>
                {String(hour).padStart(2, "0")}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Minute</span>
          <select
            value={schedule.minute}
            onChange={(event) => onChange({ ...schedule, minute: Number(event.target.value) })}
            className="h-11 rounded-lg border border-line bg-panel px-3 text-paper outline-none focus:border-brass"
          >
            {[0, 15, 30, 45, schedule.minute]
              .filter((value, index, rows) => rows.indexOf(value) === index)
              .sort((a, b) => a - b)
              .map((minute) => (
                <option key={minute} value={minute}>
                  {String(minute).padStart(2, "0")}
                </option>
              ))}
          </select>
        </label>
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Time zone</legend>
        <label className="inline-flex items-center gap-2 text-sm text-paper">
          <input
            type="radio"
            name={`${title}-tz`}
            checked={schedule.timeZone === "local"}
            onChange={() => onChange({ ...schedule, timeZone: "local" })}
          />
          Local (this browser’s clock)
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-paper">
          <input
            type="radio"
            name={`${title}-tz`}
            checked={schedule.timeZone === "utc"}
            onChange={() => onChange({ ...schedule, timeZone: "utc" })}
          />
          UTC (this server uses UTC)
        </label>
      </fieldset>
      {extra}
      <p className="text-xs text-muted">
        Last run {schedule.lastRunAt ? formatWhen(schedule.lastRunAt) : "never"} · Next run{" "}
        {schedule.nextRunAt ? formatWhen(schedule.nextRunAt) : "not scheduled"}
      </p>
    </fieldset>
  )
}

function SchedulePanel({
  scanSchedule,
  trafficSchedule,
  selectedPinCount,
  busy,
  onScanChange,
  onTrafficChange,
  onSave,
}: {
  scanSchedule: ScanSchedule
  trafficSchedule: TrafficSchedule
  selectedPinCount: number
  busy: boolean
  onScanChange: (next: ScanSchedule) => void
  onTrafficChange: (next: TrafficSchedule) => void
  onSave: () => void
}) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5 sm:p-6" data-testid="schedules">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Schedules</p>
      <h4 className="font-display text-2xl text-paper">When scans and traffic run</h4>
      <p className="mt-1 text-sm text-muted">
        Automatic jobs start on this web process every minute. Keep a single server replica so the same scan or traffic job does not fire twice.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ScheduleFieldset
          title="Scan schedule"
          detail="Rerun the latest keywords and grid at this time."
          schedule={scanSchedule}
          onChange={onScanChange}
        />
        <ScheduleFieldset
          title="Traffic schedule"
          detail="Start traffic using the last Searches count, selected keywords, and selected pins or every pin where the listing was found."
          schedule={trafficSchedule}
          onChange={(next) => onTrafficChange({ ...trafficSchedule, ...next })}
          extra={
            <label className="grid gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Pins</span>
              <select
                value={trafficSchedule.pinMode}
                onChange={(event) =>
                  onTrafficChange({
                    ...trafficSchedule,
                    pinMode: event.target.value === "all_found" ? "all_found" : "selected",
                  })
                }
                className="h-11 rounded-lg border border-line bg-panel px-3 text-paper outline-none focus:border-brass"
              >
                <option value="selected">Last selected pins ({selectedPinCount})</option>
                <option value="all_found">Every pin where the listing was found</option>
              </select>
            </label>
          }
        />
      </div>
      <button
        type="button"
        data-testid="save-schedules"
        onClick={onSave}
        disabled={busy}
        className="mt-4 inline-flex h-11 items-center rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60"
      >
        Save schedules
      </button>
    </section>
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
