"use client"

import { useEffect, useMemo } from "react"
import {
  MapContainer,
  Rectangle,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

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

export default function RankMap({
  points,
  results,
  loadingIds,
  selectedId,
  spacingMiles,
  placingCenter,
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
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <FitToGrid points={points} />
      <MapClick enabled={placingCenter} onPickCenter={onPickCenter} />
      {points.map((point) => {
        const result = results[point.id]
        const loading = loadingIds.has(point.id)
        const selected = selectedId === point.id
        const tone = rankTone(result?.rank, result?.error)
        const fill = loading ? "#94a3b8" : result ? tone.fill : "#cbd5e1"
        const label = loading ? "…" : result ? rankLabel(result.rank, result.error) : ""

        return (
          <Rectangle
            key={point.id}
            bounds={cellBounds(point.lat, point.lng, spacingMiles)}
            pathOptions={{
              color: selected ? "#0f172a" : "#ffffff",
              weight: selected ? 3 : 1.5,
              fillColor: fill,
              fillOpacity: result || loading ? 0.78 : 0.38,
            }}
            eventHandlers={{
              click: () => onSelect(point.id),
            }}
          >
            <Tooltip
              permanent
              direction="center"
              className="rank-cell-label"
              opacity={1}
            >
              <span
                style={{ color: result && !loading ? tone.text : "#0f172a" }}
                className="block min-w-4 text-center text-[13px] font-bold leading-none"
              >
                {label}
              </span>
            </Tooltip>
          </Rectangle>
        )
      })}
    </MapContainer>
  )
}
