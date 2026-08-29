"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Crosshair, Loader2, MapPin, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { estimateScanCostUsd } from "@/lib/grid"
import type { DeviceType, GeocodeHit, GridSize, ScanConfig } from "@/lib/types"

type ScanFormProps = {
  config: ScanConfig
  onChange: (patch: Partial<ScanConfig>) => void
  onSubmit: () => void
  onCancel: () => void
  scanning: boolean
  liveConfigured: boolean
  placingCenter: boolean
  onTogglePlaceCenter: () => void
}

export function ScanForm({
  config,
  onChange,
  onSubmit,
  onCancel,
  scanning,
  liveConfigured,
  placingCenter,
  onTogglePlaceCenter,
}: ScanFormProps) {
  const pointCount = config.gridSize * config.gridSize
  const cost = estimateScanCostUsd(pointCount)

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <Field label="Keyword" hint="The Google Maps search you want to rank for.">
        <Input
          value={config.keyword}
          onChange={(event) => onChange({ keyword: event.target.value })}
          placeholder="coffee"
          required
        />
      </Field>

      <Field
        label="Target business"
        hint="Name or Place ID of the listing you are tracking."
      >
        <Input
          value={config.targetBusiness}
          onChange={(event) => onChange({ targetBusiness: event.target.value })}
          placeholder="Houndstooth Coffee"
          required
        />
      </Field>

      <Field label="Grid center" hint="Search an address or drop a pin on the map.">
        <LocationSearch
          key={config.locationLabel}
          locationLabel={config.locationLabel}
          onSelect={(hit) =>
            onChange({
              locationLabel: hit.label,
              center: { lat: hit.lat, lng: hit.lng },
            })
          }
        />
        <Button
          type="button"
          variant={placingCenter ? "default" : "outline"}
          size="sm"
          className="mt-2 w-full"
          onClick={onTogglePlaceCenter}
        >
          <Crosshair />
          {placingCenter ? "Click the map, then I’m done" : "Drop pin on map"}
        </Button>
        <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
          {config.center.lat.toFixed(5)}, {config.center.lng.toFixed(5)}
        </p>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Grid">
          <Select
            value={String(config.gridSize)}
            onValueChange={(value) => {
              if (value) onChange({ gridSize: Number(value) as GridSize })
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 × 3 · 9 pins</SelectItem>
              <SelectItem value="5">5 × 5 · 25 pins</SelectItem>
              <SelectItem value="7">7 × 7 · 49 pins</SelectItem>
              <SelectItem value="9">9 × 9 · 81 pins</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Language">
          <Select
            value={config.languageCode}
            onValueChange={(value) => {
              if (value) onChange({ languageCode: value })
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Spanish</SelectItem>
              <SelectItem value="fr">French</SelectItem>
              <SelectItem value="de">German</SelectItem>
              <SelectItem value="pt">Portuguese</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field
        label={`Point spacing · ${config.spacingMiles.toFixed(1)} mi`}
        hint="Distance between neighboring GPS samples."
      >
        <Slider
          min={0.3}
          max={3}
          step={0.1}
          value={[config.spacingMiles]}
          onValueChange={(value) => {
            const next = Array.isArray(value) ? value[0] : value
            if (typeof next === "number") onChange({ spacingMiles: next })
          }}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Maps zoom">
          <Select
            value={String(config.zoom)}
            onValueChange={(value) => {
              if (value) onChange({ zoom: Number(value) })
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[13, 14, 15, 16, 17, 18].map((zoom) => (
                <SelectItem key={zoom} value={String(zoom)}>
                  {zoom}z
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Device">
          <Select
            value={config.device}
            onValueChange={(value) => {
              if (value) onChange({ device: value as DeviceType })
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desktop">Desktop</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <label className="flex items-start gap-2 rounded-xl border bg-card/70 px-3 py-2.5 text-xs leading-5">
        <input
          type="checkbox"
          className="mt-0.5 size-3.5 accent-[var(--primary)]"
          checked={config.forceMock || !liveConfigured}
          disabled={!liveConfigured}
          onChange={(event) => onChange({ forceMock: event.target.checked })}
        />
        <span>
          <span className="font-medium text-foreground">Use demo data</span>
          <span className="mt-0.5 block text-muted-foreground">
            {liveConfigured
              ? "Skip DataForSEO and run the Austin coffee mock so you can preview the grid."
              : "Live API is off until you add DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD."}
          </span>
        </span>
      </label>

      <div className="rounded-xl bg-muted/70 px-3 py-2.5 text-xs text-muted-foreground">
        This scan posts {pointCount} Google Maps tasks
        {config.forceMock || !liveConfigured
          ? " against the mock engine."
          : ` to DataForSEO live (~$${cost.toFixed(3)}).`}
      </div>

      {scanning ? (
        <Button type="button" variant="outline" onClick={onCancel}>
          Stop scan
        </Button>
      ) : (
        <Button type="submit" size="lg" className="h-10">
          Run {config.gridSize}×{config.gridSize} scan
        </Button>
      )}
    </form>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] leading-4 text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function LocationSearch({
  locationLabel,
  onSelect,
}: {
  locationLabel: string
  onSelect: (hit: GeocodeHit) => void
}) {
  const [query, setQuery] = useState(locationLabel)
  const [hits, setHits] = useState<GeocodeHit[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<number | null>(null)
  const canSearch = query.trim().length >= 3 && query.trim() !== locationLabel

  useEffect(() => {
    if (!canSearch) return
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true)
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`)
        const data = (await response.json()) as { hits?: GeocodeHit[] }
        setHits(data.hits ?? [])
      } catch {
        setHits([])
      } finally {
        setSearching(false)
      }
    }, 450)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [canSearch, query])

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-2 left-2.5 size-3.5 text-muted-foreground" />
      <Input
        className="pl-8"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          if (event.target.value.trim() === locationLabel) {
            setHits([])
          }
        }}
        placeholder="Downtown Austin, TX"
      />
      {searching && (
        <Loader2 className="absolute top-2 right-2.5 size-3.5 animate-spin text-muted-foreground" />
      )}
      {canSearch && hits.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-md">
          {hits.map((hit) => (
            <button
              key={`${hit.lat}-${hit.lng}-${hit.label}`}
              type="button"
              className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
              onClick={() => onSelect(hit)}
            >
              <MapPin className="mt-0.5 size-3 shrink-0" />
              <span>{hit.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
