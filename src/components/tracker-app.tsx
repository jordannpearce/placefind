"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Info, Menu, PanelRight, X } from "lucide-react"

import { ScanForm } from "@/components/scan-form"
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
import { buildGrid, suggestedZoom } from "@/lib/grid"
import { mapPool } from "@/lib/pool"
import { computeStats } from "@/lib/stats"
import type { GeocodeHit, PointResult, ScanConfig, ScanPointResponse } from "@/lib/types"
import { cn } from "@/lib/utils"

const RankMap = dynamic(() => import("@/components/rank-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
})

const DEFAULT_CONFIG: ScanConfig = {
  keyword: "coffee",
  targetBusiness: "Houndstooth Coffee",
  targetPlaceId: "",
  locationLabel: "Downtown Austin, TX",
  center: { lat: 30.2672, lng: -97.7431 },
  gridSize: 5,
  spacingMiles: 0.7,
  zoom: 15,
  languageCode: "en",
  device: "desktop",
  depth: 20,
  forceMock: true,
}

export function TrackerApp() {
  const [config, setConfig] = useState<ScanConfig>(DEFAULT_CONFIG)
  const [results, setResults] = useState<Record<string, PointResult>>({})
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [liveConfigured, setLiveConfigured] = useState(false)
  const [modeLabel, setModeLabel] = useState<"live" | "mock">("mock")
  const [placingCenter, setPlacingCenter] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [resultsOpen, setResultsOpen] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const abortRef = useRef(false)

  const points = useMemo(
    () => buildGrid(config.center.lat, config.center.lng, config.gridSize, config.spacingMiles),
    [config.center.lat, config.center.lng, config.gridSize, config.spacingMiles]
  )

  const resultList = useMemo(() => Object.values(results), [results])
  const stats = resultList.length > 0 ? computeStats(resultList, config.targetBusiness) : null
  const selected = selectedId ? results[selectedId] ?? null : null
  const completed = resultList.length
  const total = points.length
  const progress = scanning || completed > 0 ? Math.round((completed / total) * 100) : 0

  useEffect(() => {
    fetch("/api/status")
      .then((response) => response.json())
      .then((data: { live?: boolean; mode?: "live" | "mock" }) => {
        setLiveConfigured(Boolean(data.live))
        if (data.live) {
          setConfig((current) => ({ ...current, forceMock: false }))
          setModeLabel("live")
        }
      })
      .catch(() => undefined)
  }, [])

  const patchConfig = useCallback((next: Partial<ScanConfig>) => {
    setConfig((current) => {
      const merged = { ...current, ...next }
      if (next.spacingMiles != null && next.zoom == null) {
        merged.zoom = suggestedZoom(next.spacingMiles)
      }
      return merged
    })
    if (next.center || next.gridSize || next.spacingMiles) {
      setResults({})
      setSelectedId(null)
    }
  }, [])

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

  const runScan = useCallback(async () => {
    abortRef.current = false
    setScanning(true)
    setScanError(null)
    setResults({})
    setSelectedId(null)
    setLoadingIds(new Set(points.map((point) => point.id)))

    try {
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
              keyword: config.keyword,
              targetBusiness: config.targetBusiness,
              targetPlaceId: config.targetPlaceId || undefined,
              lat: point.lat,
              lng: point.lng,
              zoom: config.zoom,
              languageCode: config.languageCode,
              device: config.device,
              depth: config.depth,
              forceMock: config.forceMock,
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
          setResults((current) => ({ ...current, [result.id]: result }))
          setLoadingIds((current) => {
            const next = new Set(current)
            next.delete(result.id)
            return next
          })
          setSelectedId((current) => current ?? result.id)
        }
      )
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Scan failed")
    } finally {
      setScanning(false)
      setLoadingIds(new Set())
    }
  }, [config, liveConfigured, points])

  const cancelScan = useCallback(() => {
    abortRef.current = true
    setScanning(false)
    setLoadingIds(new Set())
  }, [])

  const form = (
    <ScanForm
      config={config}
      onChange={patchConfig}
      onSubmit={runScan}
      onCancel={cancelScan}
      scanning={scanning}
      liveConfigured={liveConfigured}
      placingCenter={placingCenter}
      onTogglePlaceCenter={() => setPlacingCenter((value) => !value)}
    />
  )

  const resultsPanel = (
    <ResultsPanel
      stats={stats}
      selected={selected}
      targetBusiness={config.targetBusiness}
      emptyMessage="Set a keyword and business, then run a grid scan. Each square is one DataForSEO location_coordinate task."
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
                  {config.keyword} · {config.targetBusiness}
                </p>
                <p className="text-muted-foreground">
                  {config.gridSize}×{config.gridSize} · {config.spacingMiles.toFixed(1)} mi ·{" "}
                  {config.zoom}z
                </p>
              </div>
              <Legend />
            </div>
            {(scanning || (completed > 0 && completed < total)) && (
              <div className="absolute inset-x-3 bottom-3 z-[400] rounded-2xl bg-background/95 p-3 shadow-sm ring-1 ring-foreground/10 backdrop-blur">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span>
                    Scanning {completed}/{total} coordinates
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
            Live mode needs DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD. Without them, GridPin
            runs an Austin coffee demo that still uses the same grid math and ranking UI.
          </p>
        </DialogContent>
      </Dialog>
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
