"use client"

import dynamic from "next/dynamic"
import { useMemo, useState } from "react"

import { HOME_DEMO, homeDemoSpacing } from "@/lib/home-demo"
import { computeStats } from "@/lib/stats"
import type { GridPoint, KeywordResults } from "@/lib/types"
import { cn } from "@/lib/utils"

const RankMap = dynamic(() => import("@/components/rank-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
})

export function HomeTrackerDemo({
  points,
  allResults,
}: {
  points: GridPoint[]
  allResults: KeywordResults
}) {
  const [activeKeyword, setActiveKeyword] = useState(HOME_DEMO.activeKeyword)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const results = allResults[activeKeyword] ?? {}
  const stats = useMemo(
    () => computeStats(Object.values(results), HOME_DEMO.targetBusiness),
    [results]
  )

  return (
    <div className="relative h-[420px] overflow-hidden rounded-[28px] border bg-card shadow-sm md:h-[520px]">
      <RankMap
        points={points}
        results={results}
        loadingIds={new Set()}
        selectedId={selectedId}
        spacingMiles={homeDemoSpacing()}
        placingCenter={false}
        targetBusiness={HOME_DEMO.targetBusiness}
        onSelect={setSelectedId}
        onPickCenter={() => undefined}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[400] flex justify-between gap-2 p-3">
        <div className="pointer-events-auto rounded-2xl bg-background/90 px-3 py-2 text-xs shadow-sm ring-1 ring-foreground/10 backdrop-blur">
          <p className="font-medium">
            {activeKeyword} · {HOME_DEMO.targetBusiness}
          </p>
          <p className="text-muted-foreground">
            {HOME_DEMO.gridSize}×{HOME_DEMO.gridSize} · {HOME_DEMO.radiusMiles.toFixed(1)} mi ·{" "}
            {HOME_DEMO.locationLabel}
          </p>
          <p className="text-muted-foreground">
            ATR {stats.atr?.toFixed(1) ?? "—"} · pack {stats.top3Share}%
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
    <div className="pointer-events-auto hidden h-fit items-center gap-1.5 rounded-2xl bg-background/90 px-2.5 py-2 text-[11px] shadow-sm ring-1 ring-foreground/10 backdrop-blur sm:flex">
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
