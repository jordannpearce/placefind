import L from "leaflet"
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png"
import markerIcon from "leaflet/dist/images/marker-icon.png"
import markerShadow from "leaflet/dist/images/marker-shadow.png"
import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"
import { pinColor, rankLabel } from "../lib/grid.ts"
import type { GeoPoint, GridPointResult } from "../lib/types.ts"

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: string })._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

type Props = {
  center: GeoPoint | null
  points: GridPointResult[]
  selected: GridPointResult | null
  onSelect: (point: GridPointResult) => void
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    if (ch === "&") return "&amp;"
    if (ch === "<") return "&lt;"
    if (ch === ">") return "&gt;"
    if (ch === '"') return "&quot;"
    return "&#39;"
  })
}

function pinIcon(color: string, selected: boolean) {
  return L.divIcon({
    className: "pf-pin",
    html: `<span class="pf-pin-wrap${selected ? " is-selected" : ""}"><span class="pf-pin-head" style="background:${color};border-color:${selected ? "#f3ead8" : color}"></span><span class="pf-pin-point" style="border-top-color:${color}"></span></span>`,
    iconSize: [22, 32],
    iconAnchor: [11, 30],
    popupAnchor: [0, -26],
    tooltipAnchor: [0, -20],
  })
}

function popupHtml(point: GridPointResult): string {
  const rank = rankLabel(point.rank, point.error, point.scannedAt)
  const listing = point.listingTitle?.trim()
  const address = point.address?.trim()
  return `<div class="pf-popup">
    <p class="pf-popup-coords">${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}</p>
    <p class="pf-popup-rank">${escapeHtml(rank)}</p>
    ${listing ? `<p class="pf-popup-listing">${escapeHtml(listing)}</p>` : ""}
    ${address ? `<p class="pf-popup-address">${escapeHtml(address)}</p>` : ""}
  </div>`
}

export function GridMap({ center, points, selected, onSelect }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return
    const start = center ?? { lat: 39.8283, lng: -98.5795 }
    const map = L.map(hostRef.current, {
      scrollWheelZoom: true,
      zoomControl: true,
    }).setView([start.lat, start.lng], center ? 12 : 4)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    const onResize = () => map.invalidateSize()
    const observer = new ResizeObserver(onResize)
    observer.observe(hostRef.current)
    window.addEventListener("resize", onResize)
    const ready = window.setTimeout(onResize, 80)
    return () => {
      window.clearTimeout(ready)
      window.removeEventListener("resize", onResize)
      observer.disconnect()
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
      const color = pinColor(point)
      const marker = L.marker([point.lat, point.lng], {
        icon: pinIcon(color, Boolean(selectedPoint)),
        keyboard: true,
        title: `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`,
      })
      marker.bindTooltip(`${rankLabel(point.rank, point.error, point.scannedAt)} · ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`, {
        direction: "top",
      })
      marker.bindPopup(popupHtml(point), { closeButton: true })
      marker.on("click", () => onSelectRef.current(point))
      layer.addLayer(marker)
      return marker
    })
    if (center && points.length === 0) {
      L.marker([center.lat, center.lng], {
        icon: pinIcon("#e0b15b", true),
        title: "Business center",
      })
        .bindTooltip("Business center")
        .addTo(layer)
      map.setView([center.lat, center.lng], 12)
    }
    if (markers.length > 0) {
      map.fitBounds(
        L.latLngBounds(points.map((point) => [point.lat, point.lng] as L.LatLngTuple)),
        { padding: [36, 36], maxZoom: 14 },
      )
    } else if (center) {
      map.setView([center.lat, center.lng], 12)
    }
    window.setTimeout(() => map.invalidateSize(), 40)
  }, [center, points, selected])

  return (
    <div
      ref={hostRef}
      className="leaflet-host h-[26.25rem] w-full min-h-[420px] overflow-hidden rounded-none border-y border-line sm:rounded-2xl sm:border lg:h-[32rem]"
    />
  )
}
