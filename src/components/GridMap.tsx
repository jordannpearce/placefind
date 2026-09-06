import L from "leaflet"
import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"
import { rankColor, rankLabel } from "../lib/grid.ts"
import type { GeoPoint, GridPointResult } from "../lib/types.ts"

type Props = {
  center: GeoPoint | null
  points: GridPointResult[]
  selected: GridPointResult | null
  onSelect: (point: GridPointResult) => void
}

export function GridMap({ center, points, selected, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return
    const start = { lat: 39.8283, lng: -98.5795 }
    const map = L.map(hostRef.current, {
      scrollWheelZoom: true,
      zoomControl: true,
    }).setView([start.lat, start.lng], center ? 12 : 4)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    const onResize = () => map.invalidateSize()
    window.addEventListener("resize", onResize)
    const ready = window.setTimeout(onResize, 80)
    return () => {
      window.clearTimeout(ready)
      window.removeEventListener("resize", onResize)
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    const markers = points.map((point) => {
      const selectedPoint = selected && selected.row === point.row && selected.col === point.col
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: selectedPoint ? 12 : 9,
        color: selectedPoint ? "#f3ead8" : rankColor(point.rank),
        fillColor: rankColor(point.rank),
        fillOpacity: 0.9,
        weight: selectedPoint ? 3 : 2,
      })
      marker.bindTooltip(`${point.keyword} · ${rankLabel(point.rank, point.error)}`, { direction: "top" })
      marker.on("click", () => onSelectRef.current(point))
      layer.addLayer(marker)
      return marker
    })
    if (center && points.length === 0) {
      L.circleMarker([center.lat, center.lng], {
        radius: 7,
        color: "#e0b15b",
        fillColor: "#e0b15b",
        fillOpacity: 0.8,
        weight: 2,
      })
        .bindTooltip("Business center")
        .addTo(layer)
      map.setView([center.lat, center.lng], 12)
    }
    if (markers.length > 0) {
      map.fitBounds(
        L.latLngBounds(points.map((point) => [point.lat, point.lng] as L.LatLngTuple)),
        { padding: [28, 28], maxZoom: 14 },
      )
    }
    window.setTimeout(() => map.invalidateSize(), 40)
  }, [center, points, selected])

  return (
    <div
      ref={hostRef}
      className="h-[22rem] w-full min-h-[18rem] overflow-hidden rounded-2xl border border-line lg:h-[32rem]"
    />
  )
}
