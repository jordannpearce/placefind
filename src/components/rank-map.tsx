"use client"

import { useEffect, useMemo } from "react"
import {
  MapContainer,
  Marker,
  Popup,
  Rectangle,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

import { ListingCard } from "@/components/business-name"
import { cellBounds } from "@/lib/grid"
import { rankLabel, rankTone } from "@/lib/rank"
import type { GridPoint, PointResult } from "@/lib/types"
import { cn } from "@/lib/utils"

type RankMapProps = {
  points: GridPoint[]
  results: Record<string, PointResult>
  loadingIds: Set<string>
  selectedId: string | null
  spacingMiles: number
  placingCenter: boolean
  targetBusiness: string
  onSelect: (id: string) => void
  onPickCenter: (lat: number, lng: number) => void
}

function FitToGrid({ points }: { points: GridPoint[] }) {
  const map = useMap()

  useEffect(() => {
    if (points.length === 0) return
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng]))
    map.fitBounds(bounds.pad(0.35), { animate: true })
  }, [map, points])

  useEffect(() => {
    const handle = () => map.invalidateSize()
    window.addEventListener("resize", handle)
    const timer = window.setTimeout(handle, 200)
    return () => {
      window.removeEventListener("resize", handle)
      window.clearTimeout(timer)
    }
  }, [map])

  return null
}

function MapClick({
  enabled,
  onPickCenter,
}: {
  enabled: boolean
  onPickCenter: (lat: number, lng: number) => void
}) {
  useMapEvents({
    click(event) {
      if (!enabled) return
      onPickCenter(event.latlng.lat, event.latlng.lng)
    },
  })
  return null
}

function pinIcon(fill: string, text: string, label: string, selected: boolean) {
  const size = selected ? 26 : 20
  return L.divIcon({
    className: "rank-pin",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `<span class="rank-pin-inner${selected ? " is-selected" : ""}" style="background:${fill};color:${text};width:${size}px;height:${size}px">${label}</span>`,
  })
}

function PinPopup({
  result,
  targetBusiness,
}: {
  result: PointResult
  targetBusiness: string
}) {
  const listings = result.listings
  return (
    <div className="w-[260px]">
      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
        {result.locationCoordinate} · {listings.length} listing
        {listings.length === 1 ? "" : "s"}
      </p>
      {listings.length === 0 ? (
        <p className="text-xs text-muted-foreground">No businesses returned at this point.</p>
      ) : (
        <ol className="max-h-56 space-y-1.5 overflow-auto pr-1">
          {listings.map((listing) => (
            <li
              key={`${listing.placeId ?? listing.title}-${listing.rankAbsolute}-${listing.isPaid}`}
            >
              <ListingCard listing={listing} targetBusiness={targetBusiness} compact />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

export default function RankMap({
  points,
  results,
  loadingIds,
  selectedId,
  spacingMiles,
  placingCenter,
  targetBusiness,
  onSelect,
  onPickCenter,
}: RankMapProps) {
  const center = useMemo(() => {
    if (points.length === 0) return { lat: 30.2672, lng: -97.7431 }
    const mid = points[Math.floor(points.length / 2)]
    return { lat: mid.lat, lng: mid.lng }
  }, [points])

  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      className={cn(
        "h-full w-full rounded-[28px]",
        placingCenter && "cursor-crosshair"
      )}
      zoomControl={false}
      attributionControl
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToGrid points={points} />
      <MapClick enabled={placingCenter} onPickCenter={onPickCenter} />
      {points.map((point) => {
        const selected = selectedId === point.id

        return (
          <Rectangle
            key={`${point.id}-cell`}
            bounds={cellBounds(point.lat, point.lng, spacingMiles)}
            pathOptions={{
              color: selected ? "#0f172a" : "#94a3b8",
              weight: selected ? 1.25 : 0.6,
              fillColor: "#94a3b8",
              fillOpacity: 0.04,
            }}
            eventHandlers={{
              click: () => onSelect(point.id),
            }}
          />
        )
      })}
      {points.map((point) => {
        const result = results[point.id]
        const loading = loadingIds.has(point.id)
        const selected = selectedId === point.id
        const tone = rankTone(result?.rank, result?.error)
        const fill = loading ? "#94a3b8" : result ? tone.fill : "#cbd5e1"
        const label = loading ? "…" : result ? rankLabel(result.rank, result.error) : "·"

        return (
          <Marker
            key={point.id}
            position={[point.lat, point.lng]}
            icon={pinIcon(fill, result && !loading ? tone.text : "#0f172a", label, selected)}
            eventHandlers={{
              click: () => onSelect(point.id),
            }}
            zIndexOffset={selected ? 500 : 0}
          >
            {result ? (
              <Popup autoPan>
                <PinPopup result={result} targetBusiness={targetBusiness} />
              </Popup>
            ) : null}
          </Marker>
        )
      })}
    </MapContainer>
  )
}
