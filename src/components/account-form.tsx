"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ExtraScanBuy } from "@/components/extra-scan-buy"
import { AiVisibilityBuy } from "@/components/ai-visibility-buy"
import {
  campaignLimit,
  EXTRA_SLOT_PRICE,
  MAX_EXTRA_CAMPAIGNS,
  monthlyTotal,
  PLANS,
  PLAN_ORDER,
  STARTER_INCLUDED_SCANS,
} from "@/lib/plans"
import type { PlanId, PublicUser } from "@/lib/types"
import { cn } from "@/lib/utils"

export function AccountForm({ user }: { user: PublicUser }) {
  const [name, setName] = useState(user.name)
  const [company, setCompany] = useState(user.company)
  const [dfsLogin, setDfsLogin] = useState(user.dfsLogin)
  const [dfsPassword, setDfsPassword] = useState("")
  const [marketingOptIn, setMarketingOptIn] = useState(user.marketingOptIn)
  const [plan, setPlan] = useState<PlanId>(user.plan)
  const [extraCampaigns, setExtraCampaigns] = useState(user.extraCampaigns)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const extras = plan === "agency" ? extraCampaigns : 0
  const limit = campaignLimit(plan, extras)
  const total = monthlyTotal(plan, extras)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch("/api/account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company,
          dfsLogin,
          dfsPassword: dfsPassword || undefined,
          marketingOptIn,
          plan,
          extraCampaigns: extras,
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || "Could not save")
      setDfsPassword("")
      const billingChanged = plan !== user.plan || extras !== user.extraCampaigns
      setMessage(
        billingChanged
          ? "Saved. A billing email was sent for the plan or extra-slot change."
          : "Account saved."
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save")
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="space-y-8" onSubmit={save}>
      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <h2 className="font-heading text-2xl">Profile</h2>
        <Field label="Name">
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Company">
          <Input value={company} onChange={(event) => setCompany(event.target.value)} />
        </Field>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <h2 className="font-heading text-2xl">Plan</h2>
        <p className="text-sm text-muted-foreground">
          Changing plans or extra campaign slots sends a billing email (or writes it to the local
          inbox when mail is not configured).
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const item = PLANS[id]
            const selected = plan === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setPlan(id)
                  if (id !== "agency") setExtraCampaigns(0)
                }}
                className={cn(
                  "rounded-xl border p-3 text-left",
                  selected ? "border-foreground bg-muted/70" : "bg-background"
                )}
              >
                <p className="text-sm font-medium">{item.name}</p>
                <p className="font-heading text-2xl">${item.price}</p>
                <p className="text-[11px] text-muted-foreground">
                  {item.campaigns === item.maxCampaigns
                    ? `${item.campaigns} campaign${item.campaigns === 1 ? "" : "s"}`
                    : `${item.campaigns} included, up to ${item.maxCampaigns}`}
                </p>
              </button>
            )
          })}
        </div>

        {plan === "agency" ? (
          <div className="rounded-xl border bg-background p-4">
            <p className="text-sm font-medium">Extra campaign slots</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pro includes 5 campaigns. Each extra slot is ${EXTRA_SLOT_PRICE}/month, up to{" "}
              {MAX_EXTRA_CAMPAIGNS} extras (10 campaigns hard cap).
            </p>
            <div className="mt-3 flex items-center gap-3">
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Remove extra campaign slot"
                disabled={extraCampaigns <= 0}
                onClick={() => setExtraCampaigns((current) => Math.max(0, current - 1))}
              >
                −
              </Button>
              <p className="min-w-10 text-center font-heading text-2xl">{extraCampaigns}</p>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Add extra campaign slot"
                disabled={extraCampaigns >= MAX_EXTRA_CAMPAIGNS}
                onClick={() =>
                  setExtraCampaigns((current) => Math.min(MAX_EXTRA_CAMPAIGNS, current + 1))
                }
              >
                +
              </Button>
              <p className="text-sm text-muted-foreground">
                Effective limit {limit} · ${total}/month
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {PLANS[plan].name} covers {limit} campaign{limit === 1 ? "" : "s"} at ${total}/month.
            {plan === "starter"
              ? ` ${STARTER_INCLUDED_SCANS} Maps scans included each month. Extra scans are $5 each.`
              : " Extra $5 campaign slots are only on Pro."}
          </p>
        )}
      </section>

      <AiVisibilityBuy />

      {user.usesHostedMaps ? (
        <ExtraScanBuy quota={user.scanQuota} />
      ) : (
        <section className="space-y-3 rounded-2xl border bg-card p-5">
          <h2 className="font-heading text-2xl">Maps API</h2>
          <p className="text-sm text-muted-foreground">
            Optional. Live Maps scans bill to this account. Leave blank to keep using sample rankings.
          </p>
          <Field label="API login">
            <Input value={dfsLogin} onChange={(event) => setDfsLogin(event.target.value)} />
          </Field>
          <Field label="API password">
            <Input
              type="password"
              value={dfsPassword}
              onChange={(event) => setDfsPassword(event.target.value)}
              placeholder={user.hasDfsPassword ? "Saved · enter a new password to replace" : "API password"}
            />
          </Field>
        </section>
      )}

      <label className="flex items-start gap-2 text-sm leading-5">
        <input
          type="checkbox"
          className="mt-0.5 accent-[var(--primary)]"
          checked={marketingOptIn}
          onChange={(event) => setMarketingOptIn(event.target.checked)}
        />
        Send ranking tips and product announcements (marketing email).
      </label>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {message ? <p className="text-sm text-emerald-800">{message}</p> : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save account"}
      </Button>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
