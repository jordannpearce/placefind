"use client"

import { useState, type ReactNode } from "react"
import { Crosshair, ExternalLink, Loader2, Plus, Trash2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { estimateScanCostUsd, GRID_SIZES, spacingFromRadius } from "@/lib/grid"
import { formatWhen, isCampaignDue, MAX_KEYWORDS, US_STATES } from "@/lib/storage"
import type {
  BusinessCandidate,
  Campaign,
  DeviceType,
  GridSize,
  ScanConfig,
  ScheduleCadence,
} from "@/lib/types"

type ScanFormProps = {
  config: ScanConfig
  campaigns: Campaign[]
  activeCampaignId: string
  onChange: (patch: Partial<ScanConfig>) => void
  onSelectCampaign: (id: string) => void
  onCreateCampaign: () => void
  onDeleteCampaign: (id: string) => void
  onRenameCampaign: (name: string) => void
  onSubmit: (scope: "active" | "all") => void
  onCancel: () => void
  onFindBusiness: () => Promise<BusinessCandidate[]>
  onPickBusiness: (hit: BusinessCandidate) => void
  scanning: boolean
  liveConfigured: boolean
  placingCenter: boolean
  onTogglePlaceCenter: () => void
  campaignLimit: number
  campaignLimitError: string | null
}

export function ScanForm({
  config,
  campaigns,
  activeCampaignId,
  onChange,
  onSelectCampaign,
  onCreateCampaign,
  onDeleteCampaign,
  onRenameCampaign,
  onSubmit,
  onCancel,
  onFindBusiness,
  onPickBusiness,
  scanning,
  liveConfigured,
  placingCenter,
  onTogglePlaceCenter,
  campaignLimit,
  campaignLimitError,
}: ScanFormProps) {
  const [hits, setHits] = useState<BusinessCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [draftKeyword, setDraftKeyword] = useState("")
  const active = campaigns.find((campaign) => campaign.id === activeCampaignId)
  const pointCount = config.gridSize * config.gridSize
  const keywordCount = config.keywords.length
  const allCost = estimateScanCostUsd(pointCount * keywordCount)
  const oneCost = estimateScanCostUsd(pointCount)
  const due = active ? isCampaignDue(active) : false

  function addKeyword() {
    const next = draftKeyword.trim()
    if (!next) return
    const existing = config.keywords.find((keyword) => keyword.toLowerCase() === next.toLowerCase())
    if (existing) {
      onChange({ activeKeyword: existing })
      setDraftKeyword("")
      return
    }
    if (config.keywords.length >= MAX_KEYWORDS) return
    onChange({ keywords: [...config.keywords, next], activeKeyword: next })
    setDraftKeyword("")
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(keywordCount > 1 ? "all" : "active")
      }}
    >
      <Field
        label={`Campaigns · ${campaigns.length}/${campaignLimit}`}
        hint="One campaign per brand and location. Your plan sets how many you can run."
      >
        <div className="flex gap-2">
          <NativeSelect
            value={activeCampaignId}
            onChange={onSelectCampaign}
            options={campaigns.map((campaign) => ({
              value: campaign.id,
              label: `${campaign.name}${isCampaignDue(campaign) ? " · due" : ""} · ${campaign.keywords.length} kw`,
            }))}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={onCreateCampaign}
            disabled={campaigns.length >= campaignLimit}
            aria-label="New campaign"
          >
            <Plus />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={campaigns.length <= 1}
            onClick={() => onDeleteCampaign(activeCampaignId)}
            aria-label="Delete campaign"
          >
            <Trash2 />
          </Button>
        </div>
        <Input
          className="mt-2"
          value={active?.name ?? ""}
          onChange={(event) => onRenameCampaign(event.target.value)}
          placeholder="Campaign name"
        />
        {active ? (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Last scan {formatWhen(active.lastScanAt)}
            {active.schedule !== "manual" ? ` · next ${formatWhen(active.nextScanAt)}` : ""}
          </p>
        ) : null}
        {due ? (
          <p className="mt-1 rounded-lg bg-amber-100 px-2 py-1 text-[11px] text-amber-950">
            This campaign is due for a scheduled ranking check.
          </p>
        ) : null}
        {campaigns.length >= campaignLimit ? (
          <p className="mt-1 rounded-lg bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
            {campaignLimitError ||
              `This plan allows ${campaignLimit} campaign${campaignLimit === 1 ? "" : "s"}. Remove one or upgrade to add another.`}
          </p>
        ) : campaignLimitError ? (
          <p className="mt-1 rounded-lg bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
            {campaignLimitError}
          </p>
        ) : null}
      </Field>

      <Field
        label="Keywords"
        hint={`Each keyword is its own Maps search on this grid. Up to ${MAX_KEYWORDS}.`}
      >
        <div className="flex flex-wrap gap-1.5">
          {config.keywords.map((keyword) => {
            const selected = keyword === config.activeKeyword
            return (
              <span
                key={keyword}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                  selected
                    ? "border-foreground bg-foreground text-background"
                    : "border-input bg-background text-foreground"
                }`}
              >
                <button
                  type="button"
                  className="font-medium"
                  onClick={() => onChange({ activeKeyword: keyword })}
                >
                  {keyword}
                </button>
                {config.keywords.length > 1 ? (
                  <button
                    type="button"
                    aria-label={`Remove ${keyword}`}
                    className="opacity-70 hover:opacity-100"
                    onClick={() => {
                      const keywords = config.keywords.filter((item) => item !== keyword)
                      onChange({
                        keywords,
                        activeKeyword:
                          keyword === config.activeKeyword ? keywords[0] : config.activeKeyword,
                      })
                    }}
                  >
                    <X className="size-3" />
                  </button>
                ) : null}
              </span>
            )
          })}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={draftKeyword}
            onChange={(event) => setDraftKeyword(event.target.value)}
            placeholder="Add a keyword"
            disabled={config.keywords.length >= MAX_KEYWORDS}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                addKeyword()
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={addKeyword}
            disabled={!draftKeyword.trim() || config.keywords.length >= MAX_KEYWORDS}
            aria-label="Add keyword"
          >
            <Plus />
          </Button>
        </div>
      </Field>

      <div className="space-y-2">
        <p className="text-xs font-medium">Find the business</p>
        <p className="text-[11px] leading-4 text-muted-foreground">
          Type the listing name, city, and state, then confirm it on Google Maps.
        </p>
        <Input
          value={config.targetBusiness}
          onChange={(event) => onChange({ targetBusiness: event.target.value })}
          placeholder="Business name"
          required
        />
        <div className="grid grid-cols-[1fr_88px] gap-2">
          <Input
            value={config.businessCity}
            onChange={(event) => onChange({ businessCity: event.target.value })}
            placeholder="City"
            required
          />
          <NativeSelect
            value={config.businessState}
            onChange={(value) => onChange({ businessState: value })}
            options={US_STATES.map((state) => ({
              value: state.abbr,
              label: state.abbr,
            }))}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          disabled={searching || config.targetBusiness.trim().length < 2}
          onClick={async () => {
            setSearching(true)
            setSearchError(null)
            try {
              const next = await onFindBusiness()
              setHits(next)
              if (next.length === 0) {
                setSearchError(
                  liveConfigured
                    ? "No listings came back from Maps for that name and city. Check spelling, or try the city only."
                    : "No listings found. Save your DataForSEO keys in Settings, then search again — demo search only knows Austin coffee shops."
                )
              }
            } catch (error) {
              setSearchError(error instanceof Error ? error.message : "Search failed")
            } finally {
              setSearching(false)
            }
          }}
        >
          {searching ? <Loader2 className="animate-spin" /> : null}
          Search name + city + state
        </Button>
        {searchError ? <p className="text-[11px] text-destructive">{searchError}</p> : null}
        {hits.length > 0 ? (
          <div className="max-h-48 space-y-1 overflow-auto rounded-lg border p-1">
            {hits.map((hit) => (
              <div
                key={`${hit.title}-${hit.lat}-${hit.lng}`}
                className="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    onPickBusiness(hit)
                    setHits([])
                  }}
                >
                  <p className="text-xs font-medium">{hit.title}</p>
                  <p className="text-[11px] text-muted-foreground">{hit.address}</p>
                </button>
                <a
                  href={hit.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 pt-0.5 text-[11px] text-primary hover:underline"
                >
                  Maps
                  <ExternalLink className="size-3" />
                </a>
              </div>
            ))}
          </div>
        ) : null}
        {config.mapsUrl ? (
          <a
            href={config.mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Open tracked listing on Google Maps
            <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>

      <Field label="Grid center" hint="Uses the selected listing, or drop a pin.">
        <p className="text-xs">{config.locationLabel}</p>
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
        <Field label="Grid size" hint={`${pointCount} GPS pins`}>
          <NativeSelect
            value={String(config.gridSize)}
            onChange={(value) => {
              const gridSize = Number(value) as GridSize
              onChange({
                gridSize,
                spacingMiles: spacingFromRadius(config.radiusMiles, gridSize),
              })
            }}
            options={GRID_SIZES.map((size) => ({
              value: String(size),
              label: `${size} × ${size}`,
            }))}
          />
        </Field>
        <Field label="Schedule">
          <NativeSelect
            value={config.schedule}
            onChange={(value) => onChange({ schedule: value as ScheduleCadence })}
            options={[
              { value: "manual", label: "Manual only" },
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
            ]}
          />
        </Field>
      </div>

      <Field
        label={`Scan radius · ${config.radiusMiles.toFixed(1)} mi`}
        hint={`From the listing out to the edge pins. Spacing ${config.spacingMiles.toFixed(2)} mi.`}
      >
        <Slider
          min={0.5}
          max={10}
          step={0.1}
          value={[config.radiusMiles]}
          onValueChange={(value) => {
            const next = Array.isArray(value) ? value[0] : value
            if (typeof next !== "number") return
            onChange({
              radiusMiles: next,
              spacingMiles: spacingFromRadius(next, config.gridSize),
            })
          }}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Language">
          <NativeSelect
            value={config.languageCode}
            onChange={(value) => onChange({ languageCode: value })}
            options={[
              { value: "en", label: "English" },
              { value: "es", label: "Spanish" },
              { value: "fr", label: "French" },
              { value: "de", label: "German" },
              { value: "pt", label: "Portuguese" },
            ]}
          />
        </Field>
        <Field label="Device">
          <NativeSelect
            value={config.device}
            onChange={(value) => onChange({ device: value as DeviceType })}
            options={[
              { value: "desktop", label: "Desktop" },
              { value: "mobile", label: "Mobile" },
            ]}
          />
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
              ? "Skip DataForSEO and run the mock engine."
              : "Add your DataForSEO keys in Settings to run live Maps scans."}
          </span>
        </span>
      </label>

      <div className="rounded-xl bg-muted/70 px-3 py-2.5 text-xs text-muted-foreground">
        {keywordCount > 1
          ? `All ${keywordCount} keywords × ${pointCount} pins = ${pointCount * keywordCount} Maps tasks`
          : `This scan posts ${pointCount} Google Maps tasks`}
        {config.forceMock || !liveConfigured
          ? " against the mock engine."
          : ` to your DataForSEO account (~$${allCost.toFixed(3)}).`}
      </div>

      {scanning ? (
        <Button type="button" variant="outline" onClick={onCancel}>
          Stop scan
        </Button>
      ) : keywordCount > 1 ? (
        <div className="grid gap-2">
          <Button type="button" size="lg" className="h-10" onClick={() => onSubmit("all")}>
            {due ? "Run due scan · all keywords" : `Scan all ${keywordCount} keywords`}
          </Button>
          <Button type="button" variant="outline" onClick={() => onSubmit("active")}>
            Scan “{config.activeKeyword}” only
            {!(config.forceMock || !liveConfigured) ? ` (~$${oneCost.toFixed(3)})` : ""}
          </Button>
        </div>
      ) : (
        <Button type="submit" size="lg" className="h-10">
          {due ? "Run due scan" : `Run ${config.gridSize}×${config.gridSize} scan`}
        </Button>
      )}
    </form>
  )
}

function NativeSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <select
      key={options.map((option) => option.label).join("|")}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
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
