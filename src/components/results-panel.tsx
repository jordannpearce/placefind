"use client"

import { Star } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { rankTone } from "@/lib/rank"
import type { PointResult, ScanStats } from "@/lib/types"
import { cn } from "@/lib/utils"

type ResultsPanelProps = {
  stats: ScanStats | null
  selected: PointResult | null
  targetBusiness: string
  emptyMessage: string
}

export function ResultsPanel({
  stats,
  selected,
  targetBusiness,
  emptyMessage,
}: ResultsPanelProps) {
  if (!stats) {
    return (
      <div className="flex h-full flex-col justify-center gap-2 px-1 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">No scan yet</p>
        <p>{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="ATR" value={stats.atr?.toFixed(1) ?? "—"} hint="Not found counts as 21" />
        <StatCard
          label="Avg rank"
          value={stats.averageRank?.toFixed(1) ?? "—"}
          hint="Only found pins"
        />
        <StatCard label="Local pack" value={`${stats.top3Share}%`} hint="Share of pins in top 3" />
        <StatCard label="Coverage" value={`${stats.coverage}%`} hint={`${stats.found} of ${stats.points} pins`} />
      </div>

      <Tabs defaultValue="pin" className="min-h-0 flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="pin">Selected pin</TabsTrigger>
          <TabsTrigger value="rivals">Competitors</TabsTrigger>
        </TabsList>
        <TabsContent value="pin" className="min-h-0">
          {selected ? (
            <PinDetail result={selected} targetBusiness={targetBusiness} />
          ) : (
            <p className="pt-4 text-sm text-muted-foreground">
              Click a square on the map to inspect that coordinate.
            </p>
          )}
        </TabsContent>
        <TabsContent value="rivals" className="min-h-0">
          <ScrollArea className="h-[min(420px,50vh)] pr-3">
            <div className="flex flex-col gap-2 pt-2">
              {stats.competitors.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Competitors appear after the first pins finish.
                </p>
              ) : (
                stats.competitors.map((competitor, index) => (
                  <div
                    key={competitor.placeId ?? competitor.title}
                    className="rounded-xl border bg-card px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-medium text-muted-foreground">
                          #{index + 1}
                        </p>
                        <p className="text-sm font-medium">{competitor.title}</p>
                      </div>
                      <Badge variant="secondary">{competitor.appearances} pins</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Avg rank {competitor.averageRank} · {competitor.top3Share}% top 3
                      {competitor.rating != null
                        ? ` · ${competitor.rating.toFixed(1)}★ (${competitor.reviews ?? 0})`
                        : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </p>
      <p className="font-heading text-2xl leading-tight">{value}</p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}

function PinDetail({
  result,
  targetBusiness,
}: {
  result: PointResult
  targetBusiness: string
}) {
  const tone = rankTone(result.rank, result.error)

  return (
    <div className="flex min-h-0 flex-col gap-3 pt-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Rank at this coordinate</p>
          <p className="font-heading text-3xl" style={{ color: tone.fill }}>
            {result.error ? "Error" : result.found ? `#${result.rank}` : "Not found"}
          </p>
        </div>
        <Badge style={{ background: tone.fill, color: tone.text }}>{tone.label}</Badge>
      </div>
      <p className="font-mono text-[11px] break-all text-muted-foreground">
        {result.locationCoordinate}
      </p>
      {result.error ? <p className="text-sm text-destructive">{result.error}</p> : null}
      <Separator />
      <p className="text-xs font-medium text-muted-foreground">
        Google Maps listings for this pin
      </p>
      <ScrollArea className="h-[min(360px,42vh)] pr-3">
        <ol className="flex flex-col gap-2">
          {result.listings.length === 0 ? (
            <li className="text-sm text-muted-foreground">No listings returned.</li>
          ) : (
            result.listings.map((listing) => {
              const isTarget =
                listing.title.toLowerCase().includes(targetBusiness.toLowerCase()) ||
                (listing.placeId && listing.placeId === targetBusiness)
              return (
                <li
                  key={`${listing.placeId ?? listing.title}-${listing.rankAbsolute}-${listing.isPaid}`}
                  className={cn(
                    "rounded-xl border px-3 py-2.5",
                    isTarget ? "border-primary bg-primary/5" : "bg-card"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {listing.isPaid ? "Ad · " : `#${listing.rankGroup} · `}
                        {listing.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{listing.address}</p>
                    </div>
                    {listing.rating != null && (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                        {listing.rating.toFixed(1)}
                        <span className="text-muted-foreground">({listing.reviews ?? 0})</span>
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {[listing.category, listing.domain, listing.placeId]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </li>
              )
            })
          )}
        </ol>
      </ScrollArea>
    </div>
  )
}
