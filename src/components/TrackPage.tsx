import { LoaderCircle, Plus, Star, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import {
  compareCampaignScans,
  createCampaign,
  deleteCampaign,
  loadCampaign,
  loadCampaignGrid,
  loadCampaignScans,
  loadCampaigns,
  loadCampaignTraffic,
  rerunCampaignScan,
  scanCampaign,
  searchBusiness,
  startCampaignTraffic,
  stopCampaignTraffic,
  updateCampaign,
} from "../lib/api.ts"
import { buildPreviewPoints, gridPinId, pinColor, rankColor, rankLabel } from "../lib/grid.ts"
import { pointsWithCompare, rankChangeColor, rankChangeLabel } from "../lib/scan-compare.ts"
import { mapsKeysMissingAdminMessage, publicPinScanMessage, publicSearchMessage } from "../lib/public-copy.ts"
import { US_STATES } from "../lib/states.ts"
import {
  campaignInputFromListing,
  confirmedListingFromCampaign,
  confirmedListingFromSearch,
  listingsFromSearch,
  campaignScanFinished,
  countFinishedScanPins,
  listedTrafficKeywords,
  noKeywordsSelectedMessage,
  noPinsSelectedMessage,
  scanBusinessEnabled,
  scanGridPageError,
  scanLiveStatus,
  selectedKeywordsInListedOrder,
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
} from "../lib/traffic-plan.ts"
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
  GridScanRun,
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
  const [activeKeyword, setActiveKeyword] = useState("")
  const [gridSize, setGridSize] = useState(5)
  const [spacingMiles, setSpacingMiles] = useState(1)
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
      Boolean(mapCenter) &&
      Math.abs(grid!.center.lat - mapCenter!.lat) < 1e-6 &&
      Math.abs(grid!.center.lng - mapCenter!.lng) < 1e-6
    if (scanMatches && grid) {
      if (!activeKeyword) return grid.points
      return grid.points.filter((point) => point.keyword.toLowerCase() === activeKeyword.toLowerCase())
    }
    if (!mapCenter || !confirmed) return []
    return buildPreviewPoints(mapCenter, gridSize, spacingMiles, keyword)
  }, [comparedPoints, grid, activeKeyword, gridSize, spacingMiles, mapCenter, selected?.keywords, keywordDraft, confirmed])

  function applyCampaign(campaign: Campaign | null) {
    if (!campaign) {
      setQuery(emptyQuery())
      setConfirmed(null)
      setActiveKeyword("")
      setKeywordDraft("")
      setGridSize(5)
      setSpacingMiles(1)
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
    setKeywordDraft("")
    setGridSize(campaign.gridSize ?? 5)
    setSpacingMiles(campaign.spacingMiles ?? 1)
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

  async function persistSearchCount(raw: number) {
    const value = normalizeTrafficSearches(raw)
    setSearchCount(value)
    setTrafficScheduleDraft((current) => ({ ...current, lastSearchCount: value }))
    if (!selected || creating) return
    void updateCampaign(selected.id, {
      trafficSchedule: {
        ...trafficScheduleDraft,
        lastSelectedPinIds: selectedPinIds,
        lastSelectedKeywords: selectedKeywordsInListedOrder(listedTrafficKeywords(selected), selectedKeywords),
        lastSearchCount: value,
      },
    })
      .then(replaceCampaign)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not save the search count."))
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
      setSelectedKeywords((current) => (current.some((row) => row.toLowerCase() === keyword.toLowerCase()) ? current : [...current, keyword]))
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
      setSelectedKeywords((current) => current.filter((row) => row.toLowerCase() !== keyword.toLowerCase()))
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
    setSelectedPinIds([])
    setCompare(null)
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
      replaceCampaign({
        ...campaign,
        lastGridScan: {
          id: campaign.lastGridScan?.id || "running",
          campaignId: campaign.id,
          startedAt: new Date().toISOString(),
          scannedAt: new Date().toISOString(),
          keyword: target,
          gridSize,
          spacingMiles,
          center: { lat: confirmed.lat, lng: confirmed.lng },
          placeId: confirmed.placeId,
          pointCount: gridSearchCount(gridSize),
          foundCount: 0,
          points: buildPreviewPoints({ lat: confirmed.lat, lng: confirmed.lng }, gridSize, spacingMiles, target).map(
            (point) => ({ ...point, status: "pending" as const }),
          ),
          status: "running",
        },
      })
      let payload: Awaited<ReturnType<typeof scanCampaign>> | null = null
      try {
        payload = await scanCampaign(campaign.id, keys, hideKeys, [target])
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
            setNotice(`Scan finished. ${confirmed.title} appeared at ${found} of ${total} grid points for “${target}”.`)
            return
          }
        } catch {
          // Fall through to the setup/request error.
        }
        setError(publicSearchMessage(message) || message)
        return
      }
      replaceCampaign(payload.campaign)
      setActiveKeyword(payload.grid?.keyword || target)
      setKeywordDraft("")
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
      setNotice(`Scan finished and saved. ${confirmed.title} appeared at ${found} of ${total} grid points for “${target}”.`)
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
  const liveScanLabel = scanLiveStatus(countFinishedScanPins(points), gridSearchCount(gridSize))
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
    const keywords = selectedKeywordsInListedOrder(trafficKeywords, selectedKeywords)
    if (keywords.length === 0) {
      window.alert(noKeywordsSelectedMessage())
      setError(noKeywordsSelectedMessage())
      return
    }
    const sessions = selectedPinIds.length * keywords.length
    const requests = sessions * 2
    const keywordList = keywords.map((keyword) => `“${keyword}”`).join(", then ")
    const ok = window.confirm(
      `Start traffic from ${selectedPinIds.length} selected pin${selectedPinIds.length === 1 ? "" : "s"} × ${keywords.length} keyword${keywords.length === 1 ? "" : "s"} for ${confirmed?.title || selected.businessName}?\n\nFor each selected pin, Maps will search ${keywordList} from that pin’s GPS, then open the confirmed listing when it appears.\n\nEstimated ${requests} Maps requests (2 per pin×keyword).`,
    )
    if (!ok) return
    setStartingTraffic(true)
    setError(null)
    setNotice(null)
    setTrafficPollError(null)
    try {
      const payload = await startCampaignTraffic(selected.id, keys, Boolean(hosted?.included && !seller), {
        pinIds: selectedPinIds,
        keywords,
        keywordIds: keywords,
      })
      replaceCampaign(payload.campaign)
      setNotice(
        `Traffic started from ${selectedPinIds.length} pin${selectedPinIds.length === 1 ? "" : "s"} × ${keywords.length} keyword${keywords.length === 1 ? "" : "s"} in listed order. Watch the live log under the map.`,
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
      if (source.keyword) setActiveKeyword(source.keyword)
      const payload = await rerunCampaignScan(selected.id, keys, Boolean(hosted?.included && !seller), source.keyword ? [source.keyword] : undefined)
      replaceCampaign(payload.campaign)
      await refreshScans(selected.id)
      setCompare(null)
      const found = payload.grid?.foundCount ?? 0
      const total = payload.grid?.pointCount ?? 0
      setNotice(`Rerun saved. ${found} of ${total} grid points found “${payload.grid?.keyword || source.keyword}”.`)
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
          lastSelectedKeywords: selectedKeywordsInListedOrder(listedTrafficKeywords(selected), selectedKeywords),
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
                {selectedKeywordsInListedOrder(trafficKeywords, selectedKeywords).length > 0 && selectedPinIds.length > 0
                  ? `This run will do ${plannedTrafficSearchCount(selectedPinIds.length * selectedKeywordsInListedOrder(trafficKeywords, selectedKeywords).length, searchCount)} of ${selectedPinIds.length * selectedKeywordsInListedOrder(trafficKeywords, selectedKeywords).length} pin/keyword pairs.`
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
                A {gridSize}×{gridSize} scan runs {gridSearchCount(gridSize)} paid Maps searches — one for each grid point,
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

            {showStartTraffic && trafficKeywords.length > 0 && (
              <div className="mt-5 rounded-xl border border-brass/25 bg-brass/5 px-4 py-4" data-testid="traffic-keyword-panel">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Start Traffic keywords</p>
                <p className="mt-2 text-sm text-paper/80">{trafficKeywordHelpCopy()}</p>
                <ul className="mt-3 grid gap-2">
                  {trafficKeywords.map((keyword) => {
                    const checked = selectedKeywords.some((row) => row.toLowerCase() === keyword.toLowerCase())
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
                <p className="mt-3 text-xs text-muted">
                  Selected keywords run in listed order for each selected pin
                  {selectedKeywords.length > 0
                    ? `: ${selectedKeywordsInListedOrder(trafficKeywords, selectedKeywords).join(" → ")}.`
                    : "."}
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
                  ? `Pins mark every ${gridSize}×${gridSize} search point around ${confirmed.title}. Rank 1 is the darkest green, then 2 and 3 in lighter greens; 4–6 yellow, 7–10 orange, 11–15 orange-red, and 16+ or not found in red.`
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
          UTC (Railway and this server use UTC)
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
        Automatic jobs start on this web process every minute. Keep a single Railway replica so the same scan or traffic job does not fire twice.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ScheduleFieldset
          title="Scan schedule"
          detail="Rerun the latest keyword and grid at this time."
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
