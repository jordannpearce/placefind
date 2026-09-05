"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { AiVisibilityBuy } from "@/components/ai-visibility-buy"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { AI_ENGINES } from "@/lib/cloro"
import { AI_PROMPTS_PER_BRAND } from "@/lib/plans"
import type { AiBrand, AiPromptQuota, AiScanRun } from "@/lib/types"
import { cn } from "@/lib/utils"

type BrandRow = AiBrand & { quota: AiPromptQuota }

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
  const [prompt, setPrompt] = useState("Best specialty coffee shop downtown Austin")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [selectedScanId, setSelectedScanId] = useState("")

  const load = useCallback(async () => {
    const response = await fetch("/api/ai")
    const next = (await response.json()) as WorkspacePayload
    if (!response.ok) throw new Error(next.error || "Could not load AI Visibility.")
    setData(next)
    setBrandId((current) => current || next.brands.find((brand) => brand.status === "active")?.id || "")
    setSelectedScanId((current) => current || next.scans[0]?.id || "")
  }, [])

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load AI Visibility.")
    })
  }, [load])

  const brand = data?.brands.find((item) => item.id === brandId) ?? data?.brands[0]
  const scans = useMemo(
    () => (data?.scans || []).filter((scan) => !brand || scan.brandId === brand.id),
    [data?.scans, brand]
  )
  const selected = scans.find((scan) => scan.id === selectedScanId) ?? scans[0] ?? null

  async function runScan() {
    if (!brand) return
    setPending(true)
    setError("")
    try {
      const response = await fetch("/api/ai/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: brand.id, prompt, country: "US" }),
      })
      const next = (await response.json()) as { run?: AiScanRun; error?: string }
      if (!response.ok || !next.run) throw new Error(next.error || "Scan failed.")
      setSelectedScanId(next.run.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.")
    } finally {
      setPending(false)
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
          Run a prompt against ChatGPT, Perplexity, Gemini, Copilot, Google AI Mode, and Grok. See
          whether the brand is named, who else is named, and which pages are cited. Each prompt is
          one of {AI_PROMPTS_PER_BRAND} scans for that brand this month.
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
              <p className="mt-1 text-xs text-muted-foreground">{item.domain || "No domain"}</p>
              <p className="mt-3 font-heading text-2xl">
                {item.quota.remaining}/{item.quota.included}
              </p>
              <p className="text-[11px] text-muted-foreground">prompt scans left this month</p>
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
            <h2 className="font-heading text-2xl">Run a prompt scan</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask the question a customer would type. We send the same prompt to each model and
              score mentions plus cited URLs for {brand.name}
              {brand.competitors.length
                ? ` and ${brand.competitors.map((item) => item.name).join(", ")}`
                : ""}
              .
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-prompt">Prompt</Label>
            <Textarea
              id="ai-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={3}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {AI_ENGINES.map((engine) => (
              <span key={engine.id} className="rounded-full bg-muted px-2.5 py-1 text-[11px]">
                {engine.label}
              </span>
            ))}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="button" size="lg" disabled={pending || brand.quota.remaining <= 0} onClick={() => void runScan()}>
            {pending ? "Scanning models…" : brand.quota.remaining <= 0 ? "Month’s prompts used" : "Scan AI models"}
          </Button>
        </section>
      ) : null}

      {selected ? (
        <section className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div>
            <h2 className="font-heading text-2xl">History</h2>
            <div className="mt-3 space-y-2">
              {scans.map((scan) => (
                <button
                  key={scan.id}
                  type="button"
                  onClick={() => setSelectedScanId(scan.id)}
                  className={cn(
                    "w-full rounded-xl border px-3 py-2 text-left text-sm",
                    scan.id === selected.id ? "border-foreground bg-card" : "bg-background"
                  )}
                >
                  <p className="line-clamp-2">{scan.prompt}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(scan.createdAt).toLocaleString()} · {scan.mode === "live" ? "live" : "sample"}
                  </p>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Stat
                label="Mentioned"
                value={`${selected.models.filter((model) => model.mentioned).length}/${selected.models.length}`}
              />
              <Stat
                label="Cited"
                value={`${selected.models.filter((model) => model.cited).length}/${selected.models.length}`}
              />
              <Stat
                label="Models"
                value={String(selected.models.length)}
              />
            </div>
            <div className="grid gap-3">
              {selected.models.map((model) => (
                <article key={model.engine} className="rounded-2xl border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-heading text-2xl">{model.label}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={model.mentioned ? "default" : "secondary"}>
                        {model.mentioned ? "Brand mentioned" : "Not mentioned"}
                      </Badge>
                      <Badge variant={model.cited ? "default" : "secondary"}>
                        {model.cited ? "Cited" : "No citation"}
                      </Badge>
                      {model.mentionRank ? (
                        <Badge variant="secondary">Mention rank {model.mentionRank}</Badge>
                      ) : null}
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
          </div>
        </section>
      ) : null}

      <AiVisibilityBuy
        onComplimentary={
          data?.canAddComplimentary
            ? async ({ name, domain, competitors }) => {
                const response = await fetch("/api/ai/brands", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name, domain, competitors }),
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[120px] flex-1 rounded-2xl border bg-card px-4 py-3">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="font-heading text-3xl">{value}</p>
    </div>
  )
}
