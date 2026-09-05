"use client"

import { ListingCard } from "@/components/business-name"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { rankTone } from "@/lib/rank"
import { formatRankDelta } from "@/lib/scan-compare"
import type { ScanComparison } from "@/lib/scan-compare"
import type { KeywordStatRow, PointResult, ScanStats } from "@/lib/types"

type ResultsPanelProps = {
  stats: ScanStats | null
  selected: PointResult | null
  targetBusiness: string
  emptyMessage: string
  keywordStats: KeywordStatRow[]
  activeKeyword: string
  onSelectKeyword: (keyword: string) => void
  comparison?: ScanComparison | null
}

export function ResultsPanel({
  stats,
  selected,
  targetBusiness,
  emptyMessage,
  keywordStats,
  activeKeyword,
  onSelectKeyword,
  comparison = null,
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
          {comparison ? <TabsTrigger value="compare">Compare</TabsTrigger> : null}
          {keywordStats.length > 1 ? <TabsTrigger value="keywords">Keywords</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="pin" className="min-h-0">
          {selected ? (
            <PinDetail result={selected} targetBusiness={targetBusiness} />
          ) : (
            <p className="pt-4 text-sm text-muted-foreground">
              Click a pin on the map to inspect every business ranking at that coordinate.
            </p>
          )}
        </TabsContent>
        {comparison ? (
          <TabsContent value="compare" className="min-h-0">
            <CompareDetail comparison={comparison} />
          </TabsContent>
        ) : null}
        <TabsContent value="rivals" className="min-h-0">
          <ScrollArea className="h-[min(420px,50vh)] pr-3">
            <div className="flex flex-col gap-2 pt-2">
              {stats.competitors.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Competitors appear after the first pins finish.
                </p>
              ) : (
                stats.competitors.map((competitor, index) => (
                  <div key={competitor.placeId ?? competitor.title} className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      #{index + 1} across the grid · avg rank {competitor.averageRank} ·{" "}
                      {competitor.appearances} pins
                    </p>
                    <ListingCard
                      listing={{
                        rankAbsolute: index + 1,
                        rankGroup: index + 1,
                        type: "maps_search",
                        title: competitor.title,
                        domain: null,
                        address: null,
                        placeId: competitor.placeId,
                        cid: null,
                        phone: null,
                        category: null,
                        rating: competitor.rating,
                        reviews: competitor.reviews,
                        latitude: null,
                        longitude: null,
                        url: null,
                        isPaid: false,
                      }}
                      targetBusiness={targetBusiness}
                    />
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </TabsContent>
        {keywordStats.length > 1 ? (
          <TabsContent value="keywords" className="min-h-0">
            <div className="flex flex-col gap-2 pt-2">
              <p className="text-[11px] text-muted-foreground">
                Compare this listing across every keyword on the campaign.
              </p>
              {keywordStats.map((row) => {
                const selectedKeyword = row.keyword === activeKeyword
                return (
                  <button
                    key={row.keyword}
                    type="button"
                    onClick={() => onSelectKeyword(row.keyword)}
                    className={`rounded-xl border px-3 py-2.5 text-left ${
                      selectedKeyword ? "border-foreground bg-muted/60" : "bg-card"
                    }`}
                  >
                    <p className="text-sm font-medium">{row.keyword}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      ATR {row.stats.atr?.toFixed(1) ?? "—"} · pack {row.stats.top3Share}% · coverage{" "}
                      {row.stats.coverage}% · avg {row.stats.averageRank?.toFixed(1) ?? "—"}
                    </p>
                  </button>
                )
              })}
            </div>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}

function CompareDetail({ comparison }: { comparison: ScanComparison }) {
  const atrHint =
    comparison.atrDelta == null
      ? "Need ranks on both scans"
      : comparison.atrDelta < 0
        ? "Lower ATR is better"
        : comparison.atrDelta > 0
          ? "ATR got worse"
          : "ATR unchanged"

  return (
    <div className="flex min-h-0 flex-col gap-3 pt-2">
      <p className="text-[11px] leading-4 text-muted-foreground">
        Current vs {new Date(comparison.previous.createdAt).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}{" "}
        for “{comparison.keyword}”. Green pins improved (moved closer to #1).
      </p>
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="ATR change"
          value={formatRankDelta(comparison.atrDelta)}
          hint={atrHint}
        />
        <StatCard
          label="Coverage"
          value={
            comparison.coverageDelta == null
              ? "—"
              : `${comparison.coverageDelta > 0 ? "+" : ""}${comparison.coverageDelta}%`
          }
          hint="Share of pins that found the listing"
        />
        <StatCard label="Improved" value={String(comparison.improved)} hint="Better rank" />
        <StatCard label="Declined" value={String(comparison.declined)} hint="Worse rank" />
      </div>
      <ScrollArea className="h-[min(360px,42vh)] pr-3">
        <div className="flex flex-col gap-1.5">
          {comparison.points.map((point) => (
            <div
              key={point.id}
              className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs"
            >
              <span className="font-mono text-[11px] text-muted-foreground">{point.id}</span>
              <span>
                {point.previousRank ?? "—"} → {point.currentRank ?? "—"}
              </span>
              <span
                className={
                  point.delta != null && point.delta < 0
                    ? "font-medium text-emerald-700"
                    : point.delta != null && point.delta > 0
                      ? "font-medium text-red-700"
                      : "text-muted-foreground"
                }
              >
                {point.appeared ? "new" : point.disappeared ? "lost" : formatRankDelta(point.delta)}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
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
  const organic = result.listings.filter((listing) => !listing.isPaid)

  return (
    <div className="flex min-h-0 flex-col gap-3 pt-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Target rank at this GPS point</p>
          <p className="font-heading text-3xl" style={{ color: tone.fill }}>
            {result.error ? "Error" : result.found && result.rank != null ? `#${result.rank}` : "—"}
          </p>
        </div>
        <Badge style={{ background: tone.fill, color: tone.text }}>{tone.label}</Badge>
      </div>
      <p className="font-mono text-[11px] break-all text-muted-foreground">
        {result.locationCoordinate}
      </p>
      {result.error ? <p className="text-sm text-destructive">{result.error}</p> : null}
      {!result.error && !result.found ? (
        <p className="text-sm leading-6 text-muted-foreground">
          {organic.length > 0
            ? `Maps returned ${organic.length} businesses here, but your listing was not in that pack. Google weights the searcher’s GPS. Pins on the edge of a grid often fall outside your proximity halo — that is a real rank miss, not a failed scan.`
            : "Maps returned no places at this coordinate. Try a smaller radius or a denser grid closer to the storefront."}
        </p>
      ) : null}
      <Separator />
      <div>
        <p className="text-xs font-medium text-foreground">
          All businesses ranking at this point
        </p>
        <p className="text-[11px] text-muted-foreground">
          {organic.length} organic
          {result.listings.length !== organic.length
            ? ` · ${result.listings.length - organic.length} ad`
            : ""}
        </p>
      </div>
      <ScrollArea className="h-[min(420px,48vh)] pr-3">
        <ol className="flex flex-col gap-2">
          {result.listings.length === 0 ? (
            <li className="text-sm text-muted-foreground">No listings returned.</li>
          ) : (
            result.listings.map((listing) => (
              <li
                key={`${listing.placeId ?? listing.title}-${listing.rankAbsolute}-${listing.isPaid}`}
              >
                <ListingCard listing={listing} targetBusiness={targetBusiness} />
              </li>
            ))
          )}
        </ol>
      </ScrollArea>
    </div>
  )
}
