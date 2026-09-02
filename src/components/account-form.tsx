"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PLANS, PLAN_ORDER } from "@/lib/plans"
import type { PlanId, PublicUser } from "@/lib/types"
import { cn } from "@/lib/utils"

export function AccountForm({ user }: { user: PublicUser }) {
  const [name, setName] = useState(user.name)
  const [company, setCompany] = useState(user.company)
  const [dfsLogin, setDfsLogin] = useState(user.dfsLogin)
  const [dfsPassword, setDfsPassword] = useState("")
  const [marketingOptIn, setMarketingOptIn] = useState(user.marketingOptIn)
  const [plan, setPlan] = useState<PlanId>(user.plan)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

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
        }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || "Could not save")
      setDfsPassword("")
      setMessage(
        plan !== user.plan
          ? "Saved. A billing email was sent for the plan change."
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
          Changing plans sends a billing email through Resend (or the local inbox).
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const item = PLANS[id]
            const selected = plan === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPlan(id)}
                className={cn(
                  "rounded-xl border p-3 text-left",
                  selected ? "border-foreground bg-muted/70" : "bg-background"
                )}
              >
                <p className="text-sm font-medium">{item.name}</p>
                <p className="font-heading text-2xl">${item.price}</p>
                <p className="text-[11px] text-muted-foreground">{item.campaigns} campaigns</p>
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <h2 className="font-heading text-2xl">DataForSEO</h2>
        <p className="text-sm text-muted-foreground">
          Optional. Live Maps scans bill to this account. Leave blank to keep using demo rankings.
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
