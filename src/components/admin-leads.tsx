"use client"

import { Plus } from "lucide-react"
import { useCallback, useState } from "react"

import {
  AdminLeadFormFields,
  adminLeadFormFromLead,
  adminLeadPayload,
  emptyAdminLeadForm,
  type AdminLeadFormValue,
} from "@/components/admin-lead-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

type Toast = { id: number; kind: "ok" | "err"; text: string }

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

export function AdminLeads({ initial }: { initial: LeadsPayload }) {
  const [payload, setPayload] = useState<LeadsPayload>(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cost, setCost] = useState(initial ? String(initial.costPerLeadUsd) : "50")
  const [savingCost, setSavingCost] = useState(false)
  const [selected, setSelected] = useState<MarketingLead | null>(null)
  const [assignTo, setAssignTo] = useState("")
  const [assigning, setAssigning] = useState(false)
  const [unassigning, setUnassigning] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [formOpen, setFormOpen] = useState<"add" | "edit" | null>(null)
  const [form, setForm] = useState<AdminLeadFormValue>(emptyAdminLeadForm)
  const [formPending, setFormPending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<MarketingLead | null>(null)
  const [deletePending, setDeletePending] = useState(false)

  const showToast = useCallback((kind: Toast["kind"], text: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current, { id, kind, text }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4500)
  }, [])

  function upsertLead(lead: MarketingLead) {
    setSelected((current) => (current?.id === lead.id ? lead : current))
    setPayload((current) =>
      current
        ? {
            ...current,
            leads: current.leads.some((item) => item.id === lead.id)
              ? current.leads.map((item) => (item.id === lead.id ? lead : item))
              : [lead, ...current.leads],
          }
        : current
    )
  }

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

  function openAdd() {
    setForm(emptyAdminLeadForm())
    setFormError(null)
    setFormOpen("add")
  }

  function openEdit(lead: MarketingLead) {
    setSelected(lead)
    setAssignTo(lead.assignedToUserId)
    setForm(adminLeadFormFromLead(lead))
    setFormError(null)
    setFormOpen("edit")
  }

  async function saveCost(event: React.FormEvent) {
    event.preventDefault()
    setSavingCost(true)
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
      showToast("ok", `Cost per lead is $${Number(data.costPerLeadUsd ?? cost).toFixed(2)}.`)
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Could not save cost per lead.")
    } finally {
      setSavingCost(false)
    }
  }

  async function saveForm(event: React.FormEvent) {
    event.preventDefault()
    setFormPending(true)
    setFormError(null)
    try {
      if (formOpen === "add") {
        const response = await fetch("/api/admin/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(adminLeadPayload(form, false)),
        })
        const data = (await response.json()) as { error?: string; lead?: MarketingLead }
        if (!response.ok) throw new Error(data.error || "Could not add this lead.")
        if (data.lead) {
          upsertLead(data.lead)
          setSelected(data.lead)
          setAssignTo(data.lead.assignedToUserId)
        }
        setFormOpen(null)
        showToast("ok", "Lead added.")
        return
      }

      if (formOpen === "edit" && selected) {
        const response = await fetch(`/api/admin/leads/${selected.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(adminLeadPayload(form, true)),
        })
        const data = (await response.json()) as { error?: string; lead?: MarketingLead }
        if (!response.ok) throw new Error(data.error || "Could not save this lead.")
        if (data.lead) {
          upsertLead(data.lead)
          setAssignTo(data.lead.assignedToUserId)
        }
        setFormOpen(null)
        showToast("ok", "Lead updated.")
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : "Could not save this lead."
      setFormError(text)
      showToast("err", text)
    } finally {
      setFormPending(false)
    }
  }

  async function assignLead() {
    if (!selected) return
    setAssigning(true)
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
      if (data.lead) upsertLead(data.lead)
      if (data.invoice && !data.invoice.ok) {
        showToast("err", data.invoice.error || "Assignment saved. Paddle invoice failed.")
      } else if (data.invoice?.dryRun) {
        showToast("ok", "Assigned. Invoice recorded as a dry-run (no live charge).")
      } else {
        showToast("ok", selected.assignedToUserId ? "Reassigned and invoiced." : "Assigned and invoiced.")
      }
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Could not assign this lead.")
    } finally {
      setAssigning(false)
    }
  }

  async function unassignSelected() {
    if (!selected) return
    setUnassigning(true)
    try {
      const response = await fetch(`/api/admin/leads/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unassign: true }),
      })
      const data = (await response.json()) as { error?: string; lead?: MarketingLead }
      if (!response.ok) throw new Error(data.error || "Could not unassign this lead.")
      if (data.lead) {
        upsertLead(data.lead)
        setAssignTo("")
      }
      showToast("ok", "Lead unassigned.")
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Could not unassign this lead.")
    } finally {
      setUnassigning(false)
    }
  }

  async function confirmDelete() {
    if (!deleting) return
    setDeletePending(true)
    try {
      const response = await fetch(`/api/admin/leads/${deleting.id}`, { method: "DELETE" })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || "Could not delete this lead.")
      const deletedId = deleting.id
      setPayload((current) =>
        current ? { ...current, leads: current.leads.filter((item) => item.id !== deletedId) } : current
      )
      if (selected?.id === deletedId) setSelected(null)
      setDeleting(null)
      showToast("ok", "Lead deleted.")
    } catch (err) {
      showToast("err", err instanceof Error ? err.message : "Could not delete this lead.")
    } finally {
      setDeletePending(false)
    }
  }

  const leads = payload?.leads ?? []
  const agencies = payload?.agencies ?? []
  const assignee = selected
    ? agencies.find((item) => item.id === selected.assignedToUserId)
    : undefined
  const alreadyAssigned = Boolean(selected?.assignedToUserId)
  const reassigning = alreadyAssigned && assignTo && assignTo !== selected?.assignedToUserId

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading…" : `${leads.length} lead${leads.length === 1 ? "" : "s"}`}
        </p>
        <Button type="button" onClick={openAdd}>
          <Plus />
          Add lead
        </Button>
      </div>

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
          <p>No leads yet. Submissions from /get-found show up here, or add one manually.</p>
          <Button className="mt-3" type="button" onClick={openAdd}>
            <Plus />
            Add lead
          </Button>
        </div>
      ) : (
        <>
          <ul className="space-y-3 sm:hidden">
            {leads.map((lead) => (
              <li key={lead.id} className="rounded-2xl border bg-card p-4">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => {
                    setSelected(lead)
                    setAssignTo(lead.assignedToUserId)
                  }}
                >
                  <p className="font-medium">{lead.businessName || "Untitled"}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {lead.name} · {lead.email}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {lead.city}, {lead.state} · {STATUS_LABEL[lead.status]} · {formatWhen(lead.createdAt)}
                  </p>
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="xs" variant="outline" onClick={() => openEdit(lead)}>
                    Edit
                  </Button>
                  <Button type="button" size="xs" variant="destructive" onClick={() => setDeleting(lead)}>
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto rounded-2xl border sm:block">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="bg-muted/70 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Business</th>
                  <th className="px-3 py-2 font-medium">Contact</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
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
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                        <Button type="button" size="xs" variant="outline" onClick={() => openEdit(lead)}>
                          Edit
                        </Button>
                        <Button type="button" size="xs" variant="destructive" onClick={() => setDeleting(lead)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
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
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => openEdit(selected)}>
                Edit
              </Button>
              <Button type="button" variant="destructive" onClick={() => setDeleting(selected)}>
                Delete
              </Button>
              <Button type="button" variant="outline" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
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
                  {assigning
                    ? reassigning
                      ? "Reassigning…"
                      : "Assigning…"
                    : reassigning
                      ? "Reassign & invoice"
                      : "Assign & invoice"}
                </Button>
              </div>
              {alreadyAssigned ? (
                <Button
                  className="mt-3"
                  type="button"
                  variant="outline"
                  disabled={unassigning}
                  onClick={() => void unassignSelected()}
                >
                  {unassigning ? "Unassigning…" : "Unassign"}
                </Button>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Saving field edits does not invoice. Assign or Reassign creates the Paddle invoice.
                Starter / Entry accounts cannot receive paid leads. A failed invoice still keeps the
                assignment.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <Dialog open={formOpen !== null} onOpenChange={(open) => !open && setFormOpen(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={saveForm}>
            <DialogHeader>
              <DialogTitle>{formOpen === "edit" ? "Edit lead" : "Add lead"}</DialogTitle>
              <DialogDescription>
                {formOpen === "edit"
                  ? "Update contact and listing fields. Changing the business name does not invoice. Use Assign or Reassign for billing."
                  : "Create a Get Found lead. Status starts as new. No marketing consent or Resend audience sync."}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <AdminLeadFormFields
                value={form}
                onChange={setForm}
                disabled={formPending}
                showStatus={formOpen === "edit"}
              />
            </div>
            {formError ? (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {formError}
              </p>
            ) : null}
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setFormOpen(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={formPending}>
                {formPending ? "Saving…" : formOpen === "edit" ? "Save lead" : "Add lead"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && !deletePending && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this lead?</DialogTitle>
            <DialogDescription>
              {deleting
                ? `Remove ${deleting.businessName || deleting.name || "this lead"} (${deleting.email}). The agency account and Paddle invoices stay.`
                : "This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={deletePending} onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={deletePending} onClick={() => void confirmDelete()}>
              {deletePending ? "Deleting…" : "Delete lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(20rem,calc(100%-2rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={
              toast.kind === "ok"
                ? "pointer-events-auto rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 shadow-lg"
                : "pointer-events-auto rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive shadow-lg"
            }
          >
            {toast.text}
          </div>
        ))}
      </div>
    </div>
  )
}
