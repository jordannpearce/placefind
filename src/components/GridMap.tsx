import L from "leaflet"
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png"
import markerIcon from "leaflet/dist/images/marker-icon.png"
import markerShadow from "leaflet/dist/images/marker-shadow.png"
import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"
import { gridPinId, gridPinLabel, pinColor } from "../lib/grid.ts"
import { buildPinPopupHtml, pinPopupMaxWidth, popupRankText } from "../lib/pin-popup.ts"
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
  selectedPinIds?: string[]
  pinSelectable?: boolean
  targetName?: string
  gridSize?: number
  onSelect: (point: GridPointResult) => void
  onTogglePin?: (point: GridPointResult) => void
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

function inferredGridSize(points: GridPointResult[]): number {
  if (points.length === 0) return 3
  return Math.max(...points.map((point) => Math.max(point.row, point.col))) + 1
}

export function GridMap({
  center,
  points,
  selected,
  selectedPinIds = [],
  pinSelectable = false,
  targetName = "",
  gridSize,
  onSelect,
  onTogglePin,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const onSelectRef = useRef(onSelect)
  const onTogglePinRef = useRef(onTogglePin)
  const pinSelectableRef = useRef(pinSelectable)
  onSelectRef.current = onSelect
  onTogglePinRef.current = onTogglePin
  pinSelectableRef.current = pinSelectable

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
    let cancelled = false
    const onResize = () => {
      if (cancelled || mapRef.current !== map) return
      if (!map.getPane("mapPane")) return
      map.invalidateSize()
    }
    const observer = new ResizeObserver(onResize)
    observer.observe(hostRef.current)
    window.addEventListener("resize", onResize)
    const ready = window.setTimeout(onResize, 80)
    return () => {
      cancelled = true
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
    const selectedIds = new Set(selectedPinIds)
    const size = gridSize ?? inferredGridSize(points)
    const popupWidth = pinPopupMaxWidth(typeof window !== "undefined" ? window.innerWidth : 360)
    const markers = points.map((point) => {
      const pinId = gridPinId(point)
      const trafficSelected = selectedIds.has(pinId)
      const detailSelected = Boolean(selected && selected.row === point.row && selected.col === point.col)
      const color = pinColor(point)
      const pin = gridPinLabel(point, size)
      const rank = popupRankText(point.rank, point.error, point.scannedAt, point.status)
      const marker = L.marker([point.lat, point.lng], {
        icon: pinIcon(color, trafficSelected || detailSelected),
        keyboard: true,
        title: `${pin} · ${rank}`,
      })
      marker.bindTooltip(`${pin} · ${rank}`, {
        direction: "top",
      })
      marker.bindPopup(buildPinPopupHtml({ point, gridSize: size, targetName }), {
        closeButton: true,
        autoPan: true,
        autoPanPadding: [20, 36],
        keepInView: true,
        maxWidth: popupWidth,
        minWidth: Math.min(200, popupWidth),
        className: "pf-popup-wrap",
      })
      marker.on("click", () => {
        onSelectRef.current(point)
        if (pinSelectableRef.current) onTogglePinRef.current?.(point)
      })
      layer.addLayer(marker)
      return { marker, detailSelected }
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
    const selectedMarker = markers.find((row) => row.detailSelected)?.marker
    const ready = window.setTimeout(() => {
      if (mapRef.current !== map) return
      if (!map.getPane("mapPane")) return
      map.invalidateSize()
      selectedMarker?.openPopup()
    }, 40)
    return () => window.clearTimeout(ready)
  }, [center, points, selected, selectedPinIds, targetName, gridSize])

  return (
    <div
      ref={hostRef}
      className="leaflet-host w-full overflow-hidden rounded-none border-y border-line sm:rounded-2xl sm:border"
    />
  )
}
