"use client"

import { useCallback, useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { LeadStatus, MarketingLead, PlanId } from "@/lib/types"

type AgencyOption = {
  id: string
  name: string
  email: string
  company: string
  plan: PlanId
  planLabel: string
  hasPaddleCustomer: boolean
}

type LeadsPayload = {
  leads: MarketingLead[]
  costPerLeadUsd: number
  agencies: AgencyOption[]
  error?: string
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  assigned: "Assigned",
  invoiced: "Invoiced",
  paid: "Paid",
}

function invoiceLabel(lead: MarketingLead) {
  if (lead.invoiceStatus === "failed") return "Invoice failed"
  if (lead.invoiceDryRun && lead.invoiceStatus === "invoiced") return "Invoice dry-run"
  if (lead.invoiceStatus === "invoiced") return "Invoiced"
  if (lead.invoiceStatus === "paid") return "Paid"
  return "No invoice"
}

function formatWhen(value: string | null) {
  if (!value) return "—"
  const parsed = Date.parse(value)
  if (!Number.isFinite(parsed)) return value
  return new Date(parsed).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function agencyLabel(agency: AgencyOption) {
  const shop = agency.company || agency.name
  return `${shop} · ${agency.planLabel} · ${agency.email}`
}

export function AdminLeads() {
  const [payload, setPayload] = useState<LeadsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cost, setCost] = useState("50")
  const [savingCost, setSavingCost] = useState(false)
  const [selected, setSelected] = useState<MarketingLead | null>(null)
  const [assignTo, setAssignTo] = useState("")
  const [assigning, setAssigning] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionOk, setActionOk] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/leads")
      const data = (await response.json()) as LeadsPayload
      if (!response.ok) throw new Error(data.error || "Could not load leads.")
      setPayload(data)
      setCost(String(data.costPerLeadUsd))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load leads.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function saveCost(event: React.FormEvent) {
    event.preventDefault()
    setSavingCost(true)
    setActionError(null)
    setActionOk(null)
    try {
      const response = await fetch("/api/admin/leads", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costPerLeadUsd: Number(cost) }),
      })
      const data = (await response.json()) as { error?: string; costPerLeadUsd?: number }
      if (!response.ok) throw new Error(data.error || "Could not save cost per lead.")
      setCost(String(data.costPerLeadUsd ?? cost))
      setPayload((current) =>
        current ? { ...current, costPerLeadUsd: data.costPerLeadUsd ?? current.costPerLeadUsd } : current
      )
      setActionOk(`Cost per lead is $${Number(data.costPerLeadUsd ?? cost).toFixed(2)}.`)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not save cost per lead.")
    } finally {
      setSavingCost(false)
    }
  }

  async function assignLead() {
    if (!selected) return
    setAssigning(true)
    setActionError(null)
    setActionOk(null)
    try {
      const response = await fetch(`/api/admin/leads/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignToUserId: assignTo }),
      })
      const data = (await response.json()) as {
        error?: string
        lead?: MarketingLead
        invoice?: { ok: boolean; dryRun?: boolean; error?: string }
      }
      if (!response.ok) throw new Error(data.error || "Could not assign this lead.")
      if (data.lead) {
        setSelected(data.lead)
        setPayload((current) =>
          current
            ? {
                ...current,
                leads: current.leads.map((item) => (item.id === data.lead!.id ? data.lead! : item)),
              }
            : current
        )
      }
      if (data.invoice && !data.invoice.ok) {
        setActionError(data.invoice.error || "Assignment saved. Paddle invoice failed.")
      } else if (data.invoice?.dryRun) {
        setActionOk("Assigned. Invoice recorded as a dry-run (no live charge).")
      } else {
        setActionOk("Assigned and invoiced.")
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not assign this lead.")
    } finally {
      setAssigning(false)
    }
  }

  const leads = payload?.leads ?? []
  const agencies = payload?.agencies ?? []
  const assignee = selected
    ? agencies.find((item) => item.id === selected.assignedToUserId)
    : undefined

  return (
    <div className="space-y-6">
      <form
        onSubmit={saveCost}
        className="rounded-2xl border bg-card p-4 sm:flex sm:items-end sm:justify-between sm:gap-4"
      >
        <div className="max-w-lg">
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Billing
          </p>
          <h2 className="font-heading mt-1 text-2xl">Cost per lead</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Snapshot this USD amount onto a lead when you assign it to a Pro or Advanced agency.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3 sm:mt-0">
          <div className="space-y-1.5">
            <Label htmlFor="cost-per-lead">USD</Label>
            <Input
              id="cost-per-lead"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              className="w-32"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={savingCost}>
            {savingCost ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}
      {actionOk ? <p className="text-sm text-emerald-800">{actionOk}</p> : null}

      {loading ? (
        <div className="rounded-2xl border px-4 py-10 text-sm text-muted-foreground">Loading leads…</div>
      ) : error ? (
        <div className="rounded-2xl border px-4 py-10">
          <p className="text-sm text-destructive">{error}</p>
          <Button className="mt-3" type="button" variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border px-4 py-10 text-sm text-muted-foreground">
          No Get Found leads yet. Submissions from /get-found show up here.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/70 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Business</th>
                <th className="px-3 py-2 font-medium">Contact</th>
                <th className="px-3 py-2 font-medium">Location</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="cursor-pointer border-t hover:bg-muted/40"
                  onClick={() => {
                    setSelected(lead)
                    setAssignTo(lead.assignedToUserId)
                    setActionError(null)
                    setActionOk(null)
                  }}
                >
                  <td className="px-3 py-3">
                    <p className="font-medium">{lead.businessName || "Untitled"}</p>
                    <p className="text-[11px] text-muted-foreground">{lead.primaryCategory || "No category"}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p>{lead.name}</p>
                    <p className="text-[11px] text-muted-foreground">{lead.email}</p>
                  </td>
                  <td className="px-3 py-3">
                    {lead.city}, {lead.state}
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">
                      {STATUS_LABEL[lead.status]}
                    </span>
                    {lead.invoiceStatus === "failed" ? (
                      <p className="mt-1 text-[11px] text-destructive">Invoice failed</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{formatWhen(lead.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <div className="rounded-2xl border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
                Lead detail
              </p>
              <h2 className="font-heading mt-1 text-2xl">{selected.businessName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {STATUS_LABEL[selected.status]} · {invoiceLabel(selected)} · {formatWhen(selected.createdAt)}
              </p>
            </div>
            <Button type="button" variant="outline" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>

          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            {[
              ["Contact", selected.name],
              ["Email", selected.email],
              ["Phone", selected.phone],
              ["Website", selected.website || "—"],
              ["GBP listing", selected.gbpListing || "—"],
              ["Category", selected.primaryCategory || "—"],
              ["Keyword", selected.keyword || "—"],
              ["Locations", selected.locationCount || "—"],
              ["City", selected.city],
              ["State", selected.state],
              ["Assigned to", assignee ? agencyLabel(assignee) : selected.assignedToUserId || "—"],
              ["Assigned at", formatWhen(selected.assignedAt)],
              ["Lead price", selected.leadPrice == null ? "—" : `$${selected.leadPrice.toFixed(2)}`],
              ["Invoice", invoiceLabel(selected)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-0.5 break-words">{value}</dd>
              </div>
            ))}
          </dl>
          {selected.comments ? (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground">Comments</p>
              <p className="mt-1 text-sm leading-6">{selected.comments}</p>
            </div>
          ) : null}
          {selected.invoiceError ? (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {selected.invoiceError}
            </p>
          ) : null}
          {selected.paddleInvoiceUrl ? (
            <p className="mt-3 text-sm">
              <a className="text-primary hover:underline" href={selected.paddleInvoiceUrl} target="_blank" rel="noreferrer">
                Open Paddle invoice
              </a>
            </p>
          ) : null}

          {selected.status !== "paid" ? (
            <div className="mt-6 border-t pt-4">
              <Label htmlFor="assign-agency">Assign to Pro / Advanced agency</Label>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <select
                  id="assign-agency"
                  className="h-10 min-w-0 flex-1 rounded-lg border bg-transparent px-3 text-sm"
                  value={assignTo}
                  onChange={(event) => setAssignTo(event.target.value)}
                >
                  <option value="">Choose an agency…</option>
                  {agencies.map((agency) => (
                    <option key={agency.id} value={agency.id}>
                      {agencyLabel(agency)}
                    </option>
                  ))}
                </select>
                <Button type="button" disabled={assigning || !assignTo} onClick={() => void assignLead()}>
                  {assigning ? "Assigning…" : "Assign & invoice"}
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Starter / Entry accounts cannot receive paid leads. A failed invoice still keeps the
                assignment.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
