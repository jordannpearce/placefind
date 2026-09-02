"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Info, Menu, PanelRight, Settings, X } from "lucide-react"

import { ScanForm } from "@/components/scan-form"
import { SettingsDialog } from "@/components/settings-dialog"
import { ResultsPanel } from "@/components/results-panel"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { buildGrid, spacingFromRadius, suggestedZoom } from "@/lib/grid"
import { mapPool } from "@/lib/pool"
import { computeStats } from "@/lib/stats"
import {
  campaignToConfig,
  configToCampaignPatch,
  defaultCampaign,
  deleteScans,
  loadActiveCampaignId,
  loadCampaigns,
  loadScans,
  loadSettings,
  nextScanAt,
  saveActiveCampaignId,
  saveCampaigns,
  saveScans,
  saveSettings,
  toStateAbbr,
  uniqueCampaignName,
} from "@/lib/storage"
import { campaignLimit as planCampaignLimit, campaignLimitMessage } from "@/lib/plans"
import type {
  ApiSettings,
  BusinessCandidate,
  Campaign,
  GeocodeHit,
  KeywordResults,
  KeywordStatRow,
  PlanId,
  ScanConfig,
  ScanPointResponse,
} from "@/lib/types"
import { cn } from "@/lib/utils"

const RankMap = dynamic(() => import("@/components/rank-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
})

function readWorkspace() {
  const settings = loadSettings()
  const campaigns = loadCampaigns()
  const activeId = loadActiveCampaignId(campaigns)
  const active = campaigns.find((campaign) => campaign.id === activeId) ?? campaigns[0]
  const hasUserKeys = Boolean(settings.login && settings.password)
  return {
    settings,
    campaigns,
    activeId: active.id,
    config: campaignToConfig(active, !hasUserKeys),
    scans: loadScans(active.id),
    live: hasUserKeys,
  }
}

export function TrackerApp() {
  const [workspace] = useState(readWorkspace)
  const [config, setConfig] = useState<ScanConfig>(workspace.config)
  const [campaigns, setCampaigns] = useState<Campaign[]>(workspace.campaigns)
  const [activeCampaignId, setActiveCampaignId] = useState(workspace.activeId)
  const [settings, setSettings] = useState<ApiSettings>(workspace.settings)
  const [scansByKeyword, setScansByKeyword] = useState<KeywordResults>(workspace.scans)
  const [hydratedFromServer, setHydratedFromServer] = useState(false)
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState({
    done: 0,
    total: 0,
    keyword: "",
    keywordIndex: 0,
    keywordCount: 0,
  })
  const [liveConfigured, setLiveConfigured] = useState(workspace.live)
  const [modeLabel, setModeLabel] = useState<"live" | "mock">(workspace.live ? "live" : "mock")
  const [placingCenter, setPlacingCenter] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [resultsOpen, setResultsOpen] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [campaignLimitError, setCampaignLimitError] = useState<string | null>(null)
  const [planLimits, setPlanLimits] = useState({
    plan: "enterprise" as PlanId,
    extraCampaigns: 0,
    campaignLimit: 50,
  })
  const abortRef = useRef(false)

  const points = useMemo(
    () => buildGrid(config.center.lat, config.center.lng, config.gridSize, config.spacingMiles),
    [config.center.lat, config.center.lng, config.gridSize, config.spacingMiles]
  )

  const results = scansByKeyword[config.activeKeyword] ?? {}
  const resultList = useMemo(() => Object.values(results), [results])
  const stats = resultList.length > 0 ? computeStats(resultList, config.targetBusiness) : null
  const selected = selectedId ? results[selectedId] ?? null : null
  const progress =
    scanning && scanProgress.total > 0
      ? Math.round((scanProgress.done / scanProgress.total) * 100)
      : 0
  const keywordStats: KeywordStatRow[] = config.keywords.flatMap((keyword) => {
    const rows = Object.values(scansByKeyword[keyword] ?? {})
    if (rows.length === 0) return []
    return [{ keyword, stats: computeStats(rows, config.targetBusiness) }]
  })

  useEffect(() => {
    let cancelled = false
    fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiLogin: workspace.settings.login,
        apiPassword: workspace.settings.password,
      }),
    })
      .then((response) => response.json())
      .then((data: { live?: boolean }) => {
        if (cancelled) return
        const live = Boolean(data.live) || workspace.live
        setLiveConfigured(live)
        if (live) {
          setModeLabel("live")
          setConfig((current) => ({ ...current, forceMock: false }))
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [workspace.live, workspace.settings.login, workspace.settings.password])

  useEffect(() => {
    let cancelled = false
    fetch("/api/me/workspace")
      .then((response) => (response.ok ? response.json() : null))
      .then(
        (data: {
          campaigns?: Campaign[]
          settings?: ApiSettings
          activeCampaignId?: string
          scans?: KeywordResults
          dfsLogin?: string
          plan?: PlanId
          extraCampaigns?: number
          campaignLimit?: number
        } | null) => {
          if (cancelled || !data) {
            setHydratedFromServer(true)
            return
          }
          if (data.campaigns && data.campaigns.length > 0) {
            setCampaigns(data.campaigns)
            saveCampaigns(data.campaigns)
            const activeId = data.activeCampaignId || data.campaigns[0].id
            setActiveCampaignId(activeId)
            saveActiveCampaignId(activeId)
            const active = data.campaigns.find((campaign) => campaign.id === activeId) ?? data.campaigns[0]
            setConfig(campaignToConfig(active, !data.settings?.login))
          }
          if (data.settings) {
            const settingsNext = {
              login: data.settings.login || data.dfsLogin || "",
              password: data.settings.password || "",
            }
            setSettings(settingsNext)
            saveSettings(settingsNext)
            if (settingsNext.login && settingsNext.password) {
              setLiveConfigured(true)
              setModeLabel("live")
            }
          }
          if (data.scans) setScansByKeyword(data.scans)
          if (data.plan) {
            const extras = data.extraCampaigns ?? 0
            setPlanLimits({
              plan: data.plan,
              extraCampaigns: extras,
              campaignLimit: data.campaignLimit ?? planCampaignLimit(data.plan, extras),
            })
          }
          setHydratedFromServer(true)
        }
      )
      .catch(() => setHydratedFromServer(true))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydratedFromServer) return
    let cancelled = false
    fetch("/api/me/workspace", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaigns,
        settings,
        activeCampaignId,
        scans: scansByKeyword,
      }),
    })
      .then(async (response) => {
        if (response.ok || cancelled) return
        const data = (await response.json()) as { error?: string }
        if (data.error) setCampaignLimitError(data.error)
        const refresh = await fetch("/api/me/workspace")
        if (!refresh.ok || cancelled) return
        const next = (await refresh.json()) as { campaigns?: Campaign[] }
        if (next.campaigns) {
          setCampaigns(next.campaigns)
          saveCampaigns(next.campaigns)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [activeCampaignId, campaigns, hydratedFromServer, scansByKeyword, settings])

  const persistScans = useCallback(
    (campaignId: string, scans: KeywordResults) => {
      saveScans(campaignId, scans)
    },
    []
  )

  const patchConfig = useCallback((next: Partial<ScanConfig>) => {
    setConfig((current) => {
      const merged = { ...current, ...next }
      if (next.radiusMiles != null || next.gridSize != null) {
        merged.spacingMiles = spacingFromRadius(merged.radiusMiles, merged.gridSize)
      }
      if ((next.spacingMiles != null || next.radiusMiles != null) && next.zoom == null) {
        merged.zoom = suggestedZoom(merged.spacingMiles)
      }
      setCampaigns((list) => {
        const updated = list.map((campaign) =>
          campaign.id === activeCampaignId
            ? { ...campaign, ...configToCampaignPatch(merged) }
            : campaign
        )
        saveCampaigns(updated)
        return updated
      })
      return merged
    })
    if (next.keywords) {
      setScansByKeyword((current) => {
        const kept: KeywordResults = {}
        for (const keyword of next.keywords ?? []) {
          if (current[keyword]) kept[keyword] = current[keyword]
        }
        persistScans(activeCampaignId, kept)
        return kept
      })
    }
    if (next.center || next.gridSize || next.spacingMiles || next.radiusMiles) {
      setScansByKeyword({})
      persistScans(activeCampaignId, {})
      setSelectedId(null)
    }
  }, [activeCampaignId, persistScans])

  const pickCenter = useCallback(
    async (lat: number, lng: number) => {
      patchConfig({ center: { lat, lng } })
      setPlacingCenter(false)
      try {
        const response = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`)
        const data = (await response.json()) as { hits?: GeocodeHit[] }
        const label = data.hits?.[0]?.label
        if (label) patchConfig({ center: { lat, lng }, locationLabel: label })
      } catch {
        patchConfig({
          center: { lat, lng },
          locationLabel: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        })
      }
    },
    [patchConfig]
  )

  const runScan = useCallback(async (scope: "active" | "all" = "all") => {
    const keywords = (scope === "active" ? [config.activeKeyword] : config.keywords).filter(Boolean)
    if (keywords.length === 0) return

    abortRef.current = false
    setScanning(true)
    setScanError(null)
    setSelectedId(null)
    const originalKeyword = config.activeKeyword
    const jobTotal = points.length * keywords.length
    setScanProgress({
      done: 0,
      total: jobTotal,
      keyword: keywords[0],
      keywordIndex: 1,
      keywordCount: keywords.length,
    })
    setScansByKeyword((current) => {
      const next = { ...current }
      for (const keyword of keywords) next[keyword] = {}
      return next
    })

    try {
      for (let index = 0; index < keywords.length; index += 1) {
        if (abortRef.current) break
        const keyword = keywords[index]
        setConfig((current) => ({ ...current, activeKeyword: keyword }))
        setScanProgress((current) => ({
          ...current,
          keyword,
          keywordIndex: index + 1,
        }))
        setLoadingIds(new Set(points.map((point) => point.id)))

        await mapPool(
          points,
          config.forceMock || !liveConfigured ? 8 : 4,
          async (point) => {
            if (abortRef.current) {
              return {
                id: point.id,
                lat: point.lat,
                lng: point.lng,
                locationCoordinate: "",
                rank: null,
                found: false,
                listings: [],
                error: "Cancelled",
                mode: "mock",
              } satisfies ScanPointResponse
            }

            const response = await fetch("/api/scan-point", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                pointId: point.id,
                keyword,
                targetBusiness: config.targetBusiness,
                targetPlaceId: config.targetPlaceId || undefined,
                lat: point.lat,
                lng: point.lng,
                zoom: config.zoom,
                languageCode: config.languageCode,
                device: config.device,
                depth: config.depth,
                forceMock: config.forceMock,
                apiLogin: settings.login || undefined,
                apiPassword: settings.password || undefined,
              }),
            })
            const payload = (await response.json()) as ScanPointResponse & { error?: string }
            if (!response.ok && payload.error) {
              throw new Error(payload.error)
            }
            if (payload.mode) setModeLabel(payload.mode)
            return payload
          },
          (result) => {
            setScansByKeyword((current) => ({
              ...current,
              [keyword]: { ...current[keyword], [result.id]: result },
            }))
            setLoadingIds((current) => {
              const next = new Set(current)
              next.delete(result.id)
              return next
            })
            setSelectedId((current) => current ?? result.id)
            setScanProgress((current) => ({ ...current, done: current.done + 1 }))
          }
        )
      }
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Scan failed")
    } finally {
      setScanning(false)
      setLoadingIds(new Set())
      setConfig((current) => ({
        ...current,
        activeKeyword: keywords.includes(originalKeyword) ? originalKeyword : keywords[0],
      }))
      const finishedAt = new Date()
      setScansByKeyword((current) => {
        persistScans(activeCampaignId, current)
        return current
      })
      setCampaigns((current) => {
        const next = current.map((campaign) =>
          campaign.id === activeCampaignId
            ? {
                ...campaign,
                lastScanAt: finishedAt.toISOString(),
                nextScanAt: nextScanAt(finishedAt, config.schedule),
                activeKeyword: keywords.includes(originalKeyword) ? originalKeyword : keywords[0],
              }
            : campaign
        )
        saveCampaigns(next)
        return next
      })
    }
  }, [activeCampaignId, config, liveConfigured, persistScans, points, settings])

  const cancelScan = useCallback(() => {
    abortRef.current = true
    setScanning(false)
    setLoadingIds(new Set())
  }, [])

  const selectCampaign = (id: string) => {
    const campaign = campaigns.find((item) => item.id === id)
    if (!campaign) return
    persistScans(activeCampaignId, scansByKeyword)
    setActiveCampaignId(id)
    saveActiveCampaignId(id)
    setConfig(campaignToConfig(campaign, config.forceMock))
    setScansByKeyword(loadScans(id))
    setSelectedId(null)
  }

  const createCampaign = () => {
    if (campaigns.length >= planLimits.campaignLimit) {
      setCampaignLimitError(campaignLimitMessage(planLimits.plan, planLimits.extraCampaigns))
      return
    }
    setCampaignLimitError(null)
    persistScans(activeCampaignId, scansByKeyword)
    const id = `camp_${Date.now()}`
    const campaign: Campaign = {
      ...defaultCampaign(),
      id,
      name: uniqueCampaignName(
        `${config.targetBusiness || "New brand"} · ${config.businessCity || "New location"}`,
        campaigns
      ),
      brand: config.targetBusiness,
      ...configToCampaignPatch(config),
      createdAt: new Date().toISOString(),
      lastScanAt: null,
      nextScanAt: null,
    }
    const next = [...campaigns, campaign]
    setCampaigns(next)
    saveCampaigns(next)
    setActiveCampaignId(id)
    saveActiveCampaignId(id)
    setScansByKeyword({})
    setSelectedId(null)
  }

  const deleteCampaign = (id: string) => {
    const next = campaigns.filter((campaign) => campaign.id !== id)
    if (next.length === 0) return
    deleteScans(id)
    setCampaigns(next)
    saveCampaigns(next)
    const fallback = next[0]
    setActiveCampaignId(fallback.id)
    saveActiveCampaignId(fallback.id)
    setConfig(campaignToConfig(fallback, config.forceMock))
    setScansByKeyword(loadScans(fallback.id))
    setSelectedId(null)
  }

  const renameCampaign = (name: string) => {
    setCampaigns((current) => {
      const next = current.map((campaign) =>
        campaign.id === activeCampaignId ? { ...campaign, name } : campaign
      )
      saveCampaigns(next)
      return next
    })
  }

  const findBusiness = async (): Promise<BusinessCandidate[]> => {
    const response = await fetch("/api/business-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: config.targetBusiness,
        city: config.businessCity,
        state: config.businessState,
        apiLogin: settings.login || undefined,
        apiPassword: settings.password || undefined,
      }),
    })
    const data = (await response.json()) as { hits?: BusinessCandidate[]; error?: string }
    if (!response.ok) throw new Error(data.error || "Search failed")
    return data.hits ?? []
  }

  const pickBusiness = (hit: BusinessCandidate) => {
    patchConfig({
      targetBusiness: hit.title,
      targetPlaceId: hit.placeId ?? "",
      businessCity: hit.city || config.businessCity,
      businessState: toStateAbbr(hit.state || config.businessState),
      mapsUrl: hit.mapsUrl,
      locationLabel: [hit.title, hit.city, hit.state].filter(Boolean).join(", "),
      center: { lat: hit.lat, lng: hit.lng },
    })
  }

  const form = (
    <ScanForm
      config={config}
      campaigns={campaigns}
      activeCampaignId={activeCampaignId}
      onChange={patchConfig}
      onSelectCampaign={selectCampaign}
      onCreateCampaign={createCampaign}
      onDeleteCampaign={deleteCampaign}
      onRenameCampaign={renameCampaign}
      onSubmit={runScan}
      onCancel={cancelScan}
      onFindBusiness={findBusiness}
      onPickBusiness={pickBusiness}
      scanning={scanning}
      liveConfigured={liveConfigured}
      placingCenter={placingCenter}
      onTogglePlaceCenter={() => setPlacingCenter((value) => !value)}
      campaignLimit={planLimits.campaignLimit}
      campaignLimitError={campaignLimitError}
    />
  )

  const resultsPanel = (
    <ResultsPanel
      stats={stats}
      selected={selected}
      targetBusiness={config.targetBusiness}
      emptyMessage="Add keywords and a listing, then scan this campaign. Each pin is one Maps task per keyword."
      keywordStats={keywordStats}
      activeKeyword={config.activeKeyword}
      onSelectKeyword={(keyword) => patchConfig({ activeKeyword: keyword })}
    />
  )

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSetupOpen(true)}
            aria-label="Open scan setup"
          >
            <Menu />
          </Button>
          <div>
            <p className="font-heading text-xl leading-none tracking-tight">GridPin</p>
            <p className="text-[11px] text-muted-foreground">Google Maps grid rank tracker</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "hidden rounded-full px-2.5 py-1 text-[11px] font-medium sm:inline-flex",
              modeLabel === "live"
                ? "bg-emerald-100 text-emerald-800"
                : "bg-amber-100 text-amber-900"
            )}
          >
            {modeLabel === "live" ? "DataForSEO live" : "Demo data"}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSettingsOpen(true)}
            aria-label="DataForSEO API settings"
          >
            <Settings />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setHelpOpen(true)}
            aria-label="How grid tracking works"
          >
            <Info />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="xl:hidden"
            onClick={() => setResultsOpen(true)}
          >
            <PanelRight />
            Results
          </Button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_380px]">
        <aside className="hidden min-h-0 overflow-y-auto border-r p-4 lg:block">
          {form}
        </aside>

        <main className="relative min-h-[70vh] p-3 md:p-4">
          <div className="relative h-[calc(100svh-6.5rem)] overflow-hidden rounded-[28px] border shadow-sm">
            <RankMap
              points={points}
              results={results}
              loadingIds={loadingIds}
              selectedId={selectedId}
              spacingMiles={config.spacingMiles}
              placingCenter={placingCenter}
              targetBusiness={config.targetBusiness}
              onSelect={setSelectedId}
              onPickCenter={pickCenter}
            />
            <div className="pointer-events-none absolute inset-x-0 top-0 z-[400] flex justify-between p-3">
              <div className="pointer-events-auto rounded-2xl bg-background/90 px-3 py-2 text-xs shadow-sm ring-1 ring-foreground/10 backdrop-blur">
                <p className="font-medium">
                  {config.activeKeyword} · {config.targetBusiness}
                </p>
                <p className="text-muted-foreground">
                  {config.gridSize}×{config.gridSize} · {config.radiusMiles.toFixed(1)} mi radius ·{" "}
                  {config.keywords.length} keyword{config.keywords.length === 1 ? "" : "s"}
                </p>
                {config.keywords.length > 1 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {config.keywords.map((keyword) => (
                      <button
                        key={keyword}
                        type="button"
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px]",
                          keyword === config.activeKeyword
                            ? "bg-foreground text-background"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => patchConfig({ activeKeyword: keyword })}
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <Legend />
            </div>
            {scanning && (
              <div className="absolute inset-x-3 bottom-3 z-[400] rounded-2xl bg-background/95 p-3 shadow-sm ring-1 ring-foreground/10 backdrop-blur">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span>
                    Scanning “{scanProgress.keyword}”
                    {scanProgress.keywordCount > 1
                      ? ` · keyword ${scanProgress.keywordIndex} of ${scanProgress.keywordCount}`
                      : ""}{" "}
                    · {scanProgress.done}/{scanProgress.total} tasks
                  </span>
                  <span className="text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} />
              </div>
            )}
            {placingCenter && (
              <div className="absolute bottom-3 left-1/2 z-[400] -translate-x-1/2 rounded-full bg-foreground px-3 py-1.5 text-xs text-background">
                Click the map to move the grid center
                <button
                  type="button"
                  className="ml-2 inline-flex align-middle"
                  onClick={() => setPlacingCenter(false)}
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
            {scanError && (
              <div className="absolute inset-x-3 top-16 z-[400] rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {scanError}
              </div>
            )}
          </div>
        </main>

        <aside className="hidden min-h-0 overflow-y-auto border-l p-4 xl:block">
          {resultsPanel}
        </aside>
      </div>

      <Sheet open={setupOpen} onOpenChange={setSetupOpen}>
        <SheetContent side="left" className="w-[min(100%,360px)] overflow-y-auto p-4">
          {form}
        </SheetContent>
      </Sheet>
      <Sheet open={resultsOpen} onOpenChange={setResultsOpen}>
        <SheetContent side="right" className="w-[min(100%,380px)] overflow-y-auto p-4">
          {resultsPanel}
        </SheetContent>
      </Sheet>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>How a Maps grid scan works</DialogTitle>
            <DialogDescription>
              Google ranks local results differently from each GPS point. GridPin samples a
              lattice of coordinates and asks DataForSEO for the Maps SERP at every pin.
            </DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-4 text-sm">
            <li>Build an N×N grid around your center, spaced in miles.</li>
            <li>
              POST one task per pin to{" "}
              <code className="rounded bg-muted px-1 text-xs">
                /v3/serp/google/maps/live/advanced
              </code>{" "}
              with <code className="rounded bg-muted px-1 text-xs">location_coordinate</code> as
              latitude,longitude,zoom.
            </li>
            <li>
              Read organic <code className="rounded bg-muted px-1 text-xs">maps_search</code>{" "}
              items and find your business by name or Place ID.
            </li>
            <li>Color the square by rank so the map shows where you own the local pack.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Add your DataForSEO login in Settings, or leave keys empty to run the Austin
            coffee demo. Each campaign stores a brand, location, keywords, grid, radius, and
            schedule. Switch keywords on the map after a scan to compare ranks.
          </p>
        </DialogContent>
      </Dialog>
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onSave={(next) => {
          setSettings(next)
          saveSettings(next)
          const live = Boolean(next.login && next.password)
          setLiveConfigured(live)
          setConfig((current) => ({ ...current, forceMock: !live }))
          setModeLabel(live ? "live" : "mock")
        }}
      />
    </div>
  )
}

function Legend() {
  const items = [
    { color: "#166534", label: "1" },
    { color: "#22c55e", label: "2" },
    { color: "#86efac", label: "3" },
    { color: "#facc15", label: "4" },
    { color: "#f59e0b", label: "7" },
    { color: "#ea580c", label: "10" },
    { color: "#ef4444", label: "15" },
    { color: "#b91c1c", label: "20" },
    { color: "#94a3b8", label: "—" },
  ]
  return (
    <div className="pointer-events-auto hidden items-center gap-1.5 rounded-2xl bg-background/90 px-2.5 py-2 text-[11px] shadow-sm ring-1 ring-foreground/10 backdrop-blur sm:flex">
      <span className="pr-1 text-muted-foreground">Rank</span>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-full" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  )
}
