"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { AiVisibilityBuy } from "@/components/ai-visibility-buy"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AI_ENGINES, signalLabels } from "@/lib/cloro"
import { AI_PROMPTS_PER_BRAND, AI_SCANS_PER_PROMPT } from "@/lib/plans"
import type { AiBrand, AiMatchSignals, AiPromptQuota, AiSavedPrompt, AiScanRun } from "@/lib/types"
import { cn } from "@/lib/utils"

type PromptRow = AiSavedPrompt & { scansRemaining: number; scansIncluded: number }

type BrandRow = AiBrand & { quota: AiPromptQuota; prompts: PromptRow[] }

type WorkspacePayload = {
  brands: BrandRow[]
  scans: AiScanRun[]
  canAddComplimentary: boolean
  liveConfigured: boolean
  error?: string
}

export function AiVisibilityApp() {
  const [data, setData] = useState<WorkspacePayload | null>(null)
  const [brandId, setBrandId] = useState("")
  const [promptId, setPromptId] = useState("")
  const [drafts, setDrafts] = useState<string[]>(() => Array.from({ length: AI_PROMPTS_PER_BRAND }, () => ""))
  const [pending, setPending] = useState("")
  const [error, setError] = useState("")
  const [selectedScanId, setSelectedScanId] = useState("")

  const load = useCallback(async () => {
    const response = await fetch("/api/ai")
    const next = (await response.json()) as WorkspacePayload
    if (!response.ok) throw new Error(next.error || "Could not load AI Visibility.")
    setData(next)
    setBrandId((current) => current || next.brands.find((brand) => brand.status === "active")?.id || "")
  }, [])

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load AI Visibility.")
    })
  }, [load])

  const brand = data?.brands.find((item) => item.id === brandId) ?? data?.brands[0]
  const prompts = brand?.prompts ?? []

  useEffect(() => {
    if (!brand) return
    setDrafts((current) => {
      const next = Array.from({ length: AI_PROMPTS_PER_BRAND }, (_, index) => current[index] || "")
      brand.prompts.forEach((prompt, index) => {
        if (index < AI_PROMPTS_PER_BRAND) next[index] = prompt.text
      })
      return next
    })
    setPromptId((current) => current || brand.prompts[0]?.id || "")
  }, [brand?.id, brand?.prompts])

  const selectedPrompt = prompts.find((item) => item.id === promptId) ?? prompts[0] ?? null
  const history = useMemo(
    () =>
      (data?.scans || [])
        .filter((scan) => selectedPrompt && scan.promptId === selectedPrompt.id)
        .slice()
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [data?.scans, selectedPrompt]
  )
  const selected = history.find((scan) => scan.id === selectedScanId) ?? history[history.length - 1] ?? null

  async function savePrompt(index: number, existingId?: string) {
    if (!brand) return
    setPending(`save-${index}`)
    setError("")
    try {
      const response = await fetch("/api/ai/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: brand.id, promptId: existingId, text: drafts[index] }),
      })
      const next = (await response.json()) as { prompt?: AiSavedPrompt; error?: string }
      if (!response.ok || !next.prompt) throw new Error(next.error || "Could not save the prompt.")
      setPromptId(next.prompt.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the prompt.")
    } finally {
      setPending("")
    }
  }

  async function runScan() {
    if (!brand || !selectedPrompt) return
    setPending("scan")
    setError("")
    try {
      const response = await fetch("/api/ai/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: brand.id, promptId: selectedPrompt.id, country: "US" }),
      })
      const next = (await response.json()) as { run?: AiScanRun; error?: string }
      if (!response.ok || !next.run) throw new Error(next.error || "Scan failed.")
      setSelectedScanId(next.run.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.")
    } finally {
      setPending("")
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div>
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
          Add-on
        </p>
        <h1 className="font-heading text-4xl tracking-tight">AI Visibility</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Type {AI_PROMPTS_PER_BRAND} individual prompts for this brand. Each prompt can be scanned{" "}
          {AI_SCANS_PER_PROMPT} times. Every scan is saved so you can compare whether the brand and
          competitors still appear.
        </p>
        {data ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {data.liveConfigured
              ? "Live model answers are on."
              : "Sample answers until an administrator saves a Cloro API key."}
          </p>
        ) : null}
      </div>

      {data && data.brands.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.brands.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setBrandId(item.id)}
              className={cn(
                "rounded-2xl border p-4 text-left",
                item.id === brand?.id ? "border-foreground bg-card" : "bg-background"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{item.name}</p>
                <Badge variant={item.status === "active" ? "default" : "secondary"}>{item.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.website || item.domain || "No website"}</p>
              {item.address ? <p className="mt-1 text-xs text-muted-foreground">{item.address}</p> : null}
              {item.phone ? <p className="text-xs text-muted-foreground">{item.phone}</p> : null}
              <p className="mt-3 font-heading text-2xl">
                {item.quota.used}/{item.quota.included}
              </p>
              <p className="text-[11px] text-muted-foreground">
                prompts saved · {AI_SCANS_PER_PROMPT} scans each
              </p>
            </button>
          ))}
        </section>
      ) : (
        <p className="text-sm text-muted-foreground">
          No AI Visibility brands yet. Add one below — ${199} per month per brand on any plan.
        </p>
      )}

      {brand && brand.status === "active" ? (
        <section className="space-y-4 rounded-2xl border bg-card p-5">
          <div>
            <h2 className="font-heading text-2xl">Prompts</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Type each question a customer would ask. Save it, then scan. {brand.name} is scored
              against the company name
              {brand.address ? `, address` : ""}
              {brand.phone ? `, phone` : ""}
              {brand.website || brand.domain ? `, and website` : ""}
              {brand.competitors.length
                ? ` — plus ${brand.competitors.map((item) => item.name).join(", ")}`
                : ""}
              .
            </p>
          </div>
          <div className="grid gap-3">
            {Array.from({ length: AI_PROMPTS_PER_BRAND }, (_, index) => {
              const saved = prompts[index]
              const selected = saved && selectedPrompt?.id === saved.id
              return (
                <div
                  key={saved?.id || `slot-${index}`}
                  className={cn(
                    "rounded-2xl border p-3",
                    selected ? "border-foreground bg-background" : "bg-background/60"
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor={`ai-prompt-${index}`}>Prompt {index + 1}</Label>
                    {saved ? (
                      <p className="text-[11px] text-muted-foreground">
                        {saved.scansUsed}/{saved.scansIncluded} scans used
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Not saved yet</p>
                    )}
                  </div>
                  <Textarea
                    id={`ai-prompt-${index}`}
                    value={drafts[index] || ""}
                    onChange={(event) => {
                      const value = event.target.value
                      setDrafts((current) => current.map((item, i) => (i === index ? value : item)))
                    }}
                    onFocus={() => {
                      if (saved) setPromptId(saved.id)
                    }}
                    rows={3}
                    placeholder="Who would you recommend locally, and how do I contact them?"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending.startsWith("save")}
                      onClick={() => void savePrompt(index, saved?.id)}
                    >
                      {pending === `save-${index}` ? "Saving…" : saved ? "Update prompt" : "Save prompt"}
                    </Button>
                    {saved ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={pending === "scan" || saved.scansRemaining <= 0}
                        onClick={() => {
                          setPromptId(saved.id)
                          void runScan()
                        }}
                      >
                        {pending === "scan" && selectedPrompt?.id === saved.id
                          ? "Scanning…"
                          : saved.scansRemaining <= 0
                            ? "4 scans used"
                            : `Scan · ${saved.scansRemaining} left`}
                      </Button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {AI_ENGINES.map((engine) => (
              <span key={engine.id} className="rounded-full bg-muted px-2.5 py-1 text-[11px]">
                {engine.label}
              </span>
            ))}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </section>
      ) : null}

      {selectedPrompt ? (
        <section className="space-y-4">
          <div>
            <h2 className="font-heading text-2xl">History · prompt compare</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedPrompt.text} Each column is one of the {AI_SCANS_PER_PROMPT} scans for this
              prompt.
            </p>
          </div>
          {history.length === 0 ? (
            <p className="rounded-2xl border px-4 py-8 text-sm text-muted-foreground">
              No scans yet for this prompt. Run a scan to start the comparison history.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-muted/70 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Scan</th>
                    {history.map((scan, index) => (
                      <th key={scan.id} className="px-3 py-2 font-medium">
                        <button
                          type="button"
                          className={cn(
                            "text-left",
                            selected?.id === scan.id ? "text-foreground" : "hover:text-foreground"
                          )}
                          onClick={() => setSelectedScanId(scan.id)}
                        >
                          #{index + 1}
                          <span className="mt-0.5 block font-normal text-[11px]">
                            {new Date(scan.createdAt).toLocaleString()}
                          </span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t">
                    <td className="px-3 py-2 text-xs text-muted-foreground">Brand found</td>
                    {history.map((scan) => (
                      <td key={`${scan.id}-found`} className="px-3 py-2">
                        {scan.models.filter((model) => model.mentioned).length}/{scan.models.length}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t">
                    <td className="px-3 py-2 text-xs text-muted-foreground">Cited</td>
                    {history.map((scan) => (
                      <td key={`${scan.id}-cited`} className="px-3 py-2">
                        {scan.models.filter((model) => model.cited).length}/{scan.models.length}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t">
                    <td className="px-3 py-2 text-xs text-muted-foreground">Facts</td>
                    {history.map((scan) => (
                      <td key={`${scan.id}-facts`} className="px-3 py-2">
                        {factsFoundLabel(scan.models.map((model) => model.signals))}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-t">
                    <td className="px-3 py-2 text-xs text-muted-foreground">Competitors</td>
                    {history.map((scan) => (
                      <td key={`${scan.id}-comp`} className="px-3 py-2 text-xs">
                        {competitorLine(scan) || "None"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {selected ? (
        <section className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Stat
              label="Brand found"
              value={`${selected.models.filter((model) => model.mentioned).length}/${selected.models.length}`}
            />
            <Stat
              label="Cited"
              value={`${selected.models.filter((model) => model.cited).length}/${selected.models.length}`}
            />
            <Stat label="Facts found" value={factsFoundLabel(selected.models.map((model) => model.signals))} />
            <Stat label="Models" value={String(selected.models.length)} />
          </div>
          <div className="grid gap-3">
            {selected.models.map((model) => (
              <article key={model.engine} className="rounded-2xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-heading text-2xl">{model.label}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={model.mentioned ? "default" : "secondary"}>
                      {model.mentioned ? "Brand found" : "Brand missing"}
                    </Badge>
                    <Badge variant={model.cited ? "default" : "secondary"}>
                      {model.cited ? "Cited" : "No citation"}
                    </Badge>
                    {model.mentionRank ? (
                      <Badge variant="secondary">Mention rank {model.mentionRank}</Badge>
                    ) : null}
                    {signalLabels(model.signals).map((label) => (
                      <Badge key={label} variant="secondary">
                        {label}
                      </Badge>
                    ))}
                  </div>
                </div>
                {model.error ? (
                  <p className="mt-2 text-sm text-destructive">{model.error}</p>
                ) : (
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{model.excerpt || "No excerpt."}</p>
                )}
                {model.competitors.some((item) => item.mentioned || item.cited) ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Competitors:{" "}
                    {model.competitors
                      .filter((item) => item.mentioned || item.cited)
                      .map((item) => `${item.name}${item.cited ? " (cited)" : ""}`)
                      .join(" · ")}
                  </p>
                ) : null}
                {model.sources.length > 0 ? (
                  <ol className="mt-3 space-y-1 text-xs">
                    {model.sources.map((source) => (
                      <li key={`${model.engine}-${source.position}-${source.url}`}>
                        <span className="text-muted-foreground">{source.position}.</span>{" "}
                        {source.url ? (
                          <a href={source.url} className="text-primary hover:underline" target="_blank" rel="noreferrer">
                            {source.label}
                          </a>
                        ) : (
                          source.label
                        )}
                        {source.citesBrand ? " · brand citation" : ""}
                      </li>
                    ))}
                  </ol>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <AiVisibilityBuy
        onComplimentary={
          data?.canAddComplimentary
            ? async (values) => {
                const response = await fetch("/api/ai/brands", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(values),
                })
                const next = (await response.json()) as { error?: string }
                if (!response.ok) throw new Error(next.error || "Could not add brand.")
                await load()
              }
            : undefined
        }
      />
    </div>
  )
}

function competitorLine(scan: AiScanRun) {
  const names = new Set<string>()
  for (const model of scan.models) {
    for (const item of model.competitors) {
      if (item.mentioned || item.cited) names.add(item.name)
    }
  }
  return Array.from(names).join(" · ")
}

function factsFoundLabel(all: Array<AiMatchSignals | undefined>) {
  const keys: Array<keyof AiMatchSignals> = ["name", "address", "phone", "website"]
  const found = keys.filter((key) => all.some((signals) => signals?.[key])).length
  return `${found}/4`
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[120px] flex-1 rounded-2xl border bg-card px-4 py-3">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="font-heading text-3xl">{value}</p>
    </div>
  )
}
