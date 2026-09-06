import { gridPinLabel, pointScanned, rankLabel } from "./grid.ts"
import { competitorHasGeo } from "./track.ts"
import type { CompetitorListing, GridPointResult } from "./types.ts"

export const NO_COMPETITORS_COPY = "No competitors returned for this point."
export const COMPETITORS_HEADING = "Competitors"

export function escapePopupHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&amp;"
    if (ch === "<") return "&lt;"
    if (ch === ">") return "&gt;"
    if (ch === '"') return "&quot;"
    return "&#39;"
  })
}

export function popupRankText(
  rank: number | null | undefined,
  error?: string,
  scannedAt?: string,
  status?: GridPointResult["status"],
): string {
  return rankLabel(rank, error, scannedAt, status).replace(/^#(\d+)$/, "Rank $1")
}

export function competitorGeoNote(
  row: Pick<CompetitorListing, "geoCities" | "usesStateName" | "usesStateAbbr">,
): string | null {
  if (!competitorHasGeo(row)) return null
  if (row.geoCities[0]) return row.geoCities[0]
  return "State"
}

export function pinPopupMaxWidth(viewportWidth = 360): number {
  return Math.max(200, Math.min(280, Math.floor(viewportWidth) - 40))
}

function ratingText(rating: number | null | undefined): string {
  return rating != null && Number.isFinite(rating) ? rating.toFixed(1) : ""
}

function competitorItems(rows: CompetitorListing[]): string {
  return rows
    .map((row) => {
      const rating = ratingText(row.rating)
      const geo = competitorGeoNote(row)
      return `<li class="pf-popup-comp">
        <span class="pf-popup-comp-rank">#${escapePopupHtml(String(row.rank))}</span>
        <span class="pf-popup-comp-body">
          <span class="pf-popup-comp-name">${escapePopupHtml(row.title)}</span>
          ${rating ? `<span class="pf-popup-comp-rating">${escapePopupHtml(rating)}</span>` : ""}
          ${geo ? `<span class="pf-popup-comp-geo">${escapePopupHtml(geo)}</span>` : ""}
        </span>
      </li>`
    })
    .join("")
}

export function buildPinPopupHtml(input: {
  point: GridPointResult
  gridSize: number
  targetName?: string
}): string {
  const { point, gridSize } = input
  const pin = gridPinLabel(point, gridSize)
  const target = (input.targetName || point.listingTitle || "").trim()
  const rank = popupRankText(point.rank, point.error, point.scannedAt, point.status)
  const listing = point.listingTitle?.trim()
  const address = point.address?.trim()
  const rating = ratingText(point.rating)
  const scanned = pointScanned(point)
  const competitors = point.competitors ?? []
  const showListing = listing && listing.toLowerCase() !== target.toLowerCase()
  const competitorsBlock = scanned
    ? `<div class="pf-popup-competitors">
      <p class="pf-popup-competitors-head">${COMPETITORS_HEADING}</p>
      ${
        competitors.length > 0
          ? `<ul class="pf-popup-comp-list">${competitorItems(competitors)}</ul>`
          : `<p class="pf-popup-empty">${NO_COMPETITORS_COPY}</p>`
      }
    </div>`
    : ""

  return `<div class="pf-popup" data-testid="pin-popup">
    <p class="pf-popup-pin">${escapePopupHtml(pin)}</p>
    ${target ? `<p class="pf-popup-listing">${escapePopupHtml(target)}</p>` : ""}
    <p class="pf-popup-rank">${escapePopupHtml(rank)}</p>
    ${rating ? `<p class="pf-popup-meta">${escapePopupHtml(rating)}</p>` : ""}
    ${showListing ? `<p class="pf-popup-match">${escapePopupHtml(listing)}</p>` : ""}
    ${address ? `<p class="pf-popup-address">${escapePopupHtml(address)}</p>` : ""}
    ${competitorsBlock}
  </div>`
}
