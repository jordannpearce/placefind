import { Badge } from "@/components/ui/badge"
import { formatReviews, listingMatchesTarget } from "@/lib/rank"
import type { Listing } from "@/lib/types"
import { findGeoInName, geoLabel, splitTitleByGeo } from "@/lib/us-geo"
import { cn } from "@/lib/utils"

export function BusinessTitle({
  title,
  className,
}: {
  title: string
  className?: string
}) {
  const parts = splitTitleByGeo(title)
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.geo ? (
          <mark
            key={`${part.text}-${index}`}
            className="rounded-sm bg-amber-200 px-0.5 text-inherit ring-1 ring-amber-400/50"
            title={part.kind === "state" ? "US state in name" : "US city in name"}
          >
            {part.text}
          </mark>
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        )
      )}
    </span>
  )
}

export function GeoBadge({ title }: { title: string }) {
  const label = geoLabel(findGeoInName(title))
  if (!label) return null
  return (
    <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-950">
      {label}
    </Badge>
  )
}

export function ReviewCount({
  count,
  className,
}: {
  count: number | null | undefined
  className?: string
}) {
  return (
    <span className={cn("text-xs tabular-nums text-muted-foreground", className)}>
      {formatReviews(count)}
    </span>
  )
}

export function ListingCard({
  listing,
  targetBusiness,
  compact = false,
}: {
  listing: Listing
  targetBusiness: string
  compact?: boolean
}) {
  const isTarget = listingMatchesTarget(listing, { title: targetBusiness })
  const rank = listing.isPaid ? "Ad" : listing.rankGroup > 0 ? `#${listing.rankGroup}` : "—"

  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-1.5",
        isTarget ? "border-primary bg-primary/5" : "border-border bg-card",
        compact && "px-1.5 py-1"
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-0.5 inline-flex min-w-7 justify-center rounded-md px-1 text-[11px] font-bold",
            listing.isPaid ? "bg-amber-100 text-amber-950" : "bg-muted text-foreground"
          )}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium leading-snug", compact ? "text-xs" : "text-sm")}>
            <BusinessTitle title={listing.title} />
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <ReviewCount count={listing.reviews} />
            {listing.rating != null && (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {listing.rating.toFixed(1)}★
              </span>
            )}
            <GeoBadge title={listing.title} />
          </div>
          {!compact && listing.address ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">{listing.address}</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
