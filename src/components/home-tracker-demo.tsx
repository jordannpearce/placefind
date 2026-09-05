"use client"

import dynamic from "next/dynamic"
import { useMemo, useState } from "react"
import { PanelRight } from "lucide-react"

import { ResultsPanel } from "@/components/results-panel"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
  HOME_DEMO,
  homeDemoKeywordResults,
  homeDemoKeywordStats,
  homeDemoPoints,
  homeDemoSpacing,
} from "@/lib/home-demo"
import { computeStats } from "@/lib/stats"
import { cn } from "@/lib/utils"

const RankMap = dynamic(() => import("@/components/rank-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
})

export function HomeTrackerDemo() {
  const points = useMemo(() => homeDemoPoints(), [])
  const allResults = useMemo(() => homeDemoKeywordResults(points), [points])
  const [activeKeyword, setActiveKeyword] = useState(HOME_DEMO.activeKeyword)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [resultsOpen, setResultsOpen] = useState(false)

  const results = allResults[activeKeyword] ?? {}
  const stats = useMemo(
    () => computeStats(Object.values(results), HOME_DEMO.targetBusiness),
    [results]
  )
  const keywordStats = useMemo(() => homeDemoKeywordStats(allResults), [allResults])
  const selected = selectedId ? results[selectedId] ?? null : null
  const spacing = homeDemoSpacing()

  const panel = (
    <ResultsPanel
      stats={stats}
      selected={selected}
      targetBusiness={HOME_DEMO.targetBusiness}
      emptyMessage="Sample ranks are already on the map. Click a pin to see the pack at that street."
      keywordStats={keywordStats}
      activeKeyword={activeKeyword}
      onSelectKeyword={setActiveKeyword}
    />
  )

  return (
    <section className="border-b bg-background">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 md:px-6">
          <div>
            <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Live sample · Austin coffee
            </p>
            <p className="mt-0.5 text-sm">
              Same tracker layout as a workspace — sample ranks, not a live Maps pull.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="xl:hidden"
            onClick={() => setResultsOpen(true)}
          >
            <PanelRight />
            Rankings
          </Button>
        </div>

        <div className="grid min-h-0 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_360px]">
          <aside className="hidden min-h-0 overflow-y-auto border-r p-4 lg:block">
            <DemoCampaignCard
              activeKeyword={activeKeyword}
              onSelectKeyword={setActiveKeyword}
              atr={stats.atr}
              pack={stats.top3Share}
            />
          </aside>

          <div className="relative min-h-[62vh] p-3 md:min-h-[70vh] md:p-4">
            <div className="relative h-[62vh] overflow-hidden rounded-[28px] border shadow-sm md:h-[70vh]">
              <RankMap
                points={points}
                results={results}
                loadingIds={new Set()}
                selectedId={selectedId}
                spacingMiles={spacing}
                placingCenter={false}
                targetBusiness={HOME_DEMO.targetBusiness}
                onSelect={setSelectedId}
                onPickCenter={() => undefined}
              />
              <div className="pointer-events-none absolute inset-x-0 top-0 z-[400] flex justify-between p-3">
                <div className="pointer-events-auto rounded-2xl bg-background/90 px-3 py-2 text-xs shadow-sm ring-1 ring-foreground/10 backdrop-blur">
                  <p className="font-medium">
                    {activeKeyword} · {HOME_DEMO.targetBusiness}
                  </p>
                  <p className="text-muted-foreground">
                    {HOME_DEMO.gridSize}×{HOME_DEMO.gridSize} · {HOME_DEMO.radiusMiles.toFixed(1)} mi
                    radius · {HOME_DEMO.locationLabel}
                  </p>
                  <p className="text-muted-foreground">
                    ATR {stats.atr?.toFixed(1) ?? "—"} · pack {stats.top3Share}% · {stats.found}/
                    {stats.points}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {HOME_DEMO.keywords.map((keyword) => (
                      <button
                        key={keyword}
                        type="button"
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px]",
                          keyword === activeKeyword
                            ? "bg-foreground text-background"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setActiveKeyword(keyword)}
                      >
                        {keyword}
                      </button>
                    ))}
                  </div>
                </div>
                <RankLegend />
              </div>
            </div>
          </div>

          <aside className="hidden min-h-0 overflow-y-auto border-l p-4 xl:block">{panel}</aside>
        </div>
      </div>

      <Sheet open={resultsOpen} onOpenChange={setResultsOpen}>
        <SheetContent side="right" className="w-[min(100%,380px)] overflow-y-auto p-4">
          {panel}
        </SheetContent>
      </Sheet>
    </section>
  )
}

function DemoCampaignCard({
  activeKeyword,
  onSelectKeyword,
  atr,
  pack,
}: {
  activeKeyword: string
  onSelectKeyword: (keyword: string) => void
  atr: number | null
  pack: number
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Campaign
        </p>
        <h2 className="font-heading mt-1 text-2xl leading-tight">Houndstooth · Austin</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {HOME_DEMO.targetBusiness} · {HOME_DEMO.city}, {HOME_DEMO.state}
        </p>
      </div>
      <div className="rounded-2xl border bg-card p-4 text-sm leading-6">
        <p>
          This is the same map and ranking panel you get after a grid scan. Pins are sample Austin
          coffee ranks so you can click around before you subscribe.
        </p>
        <p className="mt-3 text-muted-foreground">
          Green pins are local-pack (1–3). Orange and red are the streets a competitor already owns.
          That shape is proximity — not one vanity number from the office.
        </p>
      </div>
      <div>
        <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Keywords on this lattice
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {HOME_DEMO.keywords.map((keyword) => (
            <button
              key={keyword}
              type="button"
              className={cn(
                "rounded-full px-2.5 py-1 text-xs",
                keyword === activeKeyword
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onSelectKeyword(keyword)}
            >
              {keyword}
            </button>
          ))}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl border bg-card px-3 py-2">
          <dt className="text-[11px] text-muted-foreground">ATR</dt>
          <dd className="font-heading text-2xl">{atr?.toFixed(1) ?? "—"}</dd>
        </div>
        <div className="rounded-xl border bg-card px-3 py-2">
          <dt className="text-[11px] text-muted-foreground">Local pack</dt>
          <dd className="font-heading text-2xl">{pack}%</dd>
        </div>
      </dl>
    </div>
  )
}

function RankLegend() {
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
