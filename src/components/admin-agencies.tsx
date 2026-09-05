"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import type { AdminUserRow } from "@/components/admin-users"
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
import type { TrialUnit } from "@/lib/paddle-access"
import { MAX_EXTRA_CAMPAIGNS, PLANS, PLAN_ORDER } from "@/lib/plans"
import type { Agency, PlanId } from "@/lib/types"

type Group = Agency & { userCount: number }
type Toast = { id: number; kind: "ok" | "err"; text: string }

const emptyForm = {
  name: "",
  email: "",
  password: "",
  company: "",
  plan: "agency" as PlanId,
  extraCampaigns: 0,
  sendEmail: true,
  trialAmount: 0,
  trialUnit: "days" as TrialUnit,
}

function formatTrial(trialEndsAt: string | null | undefined) {
  if (!trialEndsAt) return "No trial"
  const ends = Date.parse(trialEndsAt)
  if (!Number.isFinite(ends)) return "No trial"
  const when = new Date(ends).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
  return ends <= Date.now() ? `Expired ${when}` : `Until ${when}`
}

export function AdminAgencies({
  agencies,
  users,
  currentUserId,
}: {
  agencies: Group[]
  users: AdminUserRow[]
  currentUserId: string
}) {
  const router = useRouter()
  const [groups, setGroups] = useState(agencies)
  const [rows, setRows] = useState(users)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<AdminUserRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AdminUserRow | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    company: "",
    plan: "agency" as PlanId,
    extraCampaigns: 0,
    trialAmount: 7,
    trialUnit: "days" as TrialUnit,
    applyTrial: false,
    clearTrial: false,
  })
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  function showToast(kind: Toast["kind"], text: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current, { id, kind, text }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4500)
  }

  function applyUser(next: AdminUserRow) {
    setRows((current) => {
      const exists = current.some((row) => row.id === next.id)
      if (!exists) return [next, ...current]
      return current.map((row) => (row.id === next.id ? { ...row, ...next } : row))
    })
  }

  async function createAgency(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = (await response.json()) as {
        error?: string
        user?: AdminUserRow
        agencies?: Group[]
        previewUrl?: string | null
      }
      if (!response.ok) throw new Error(data.error || "Could not create agency")
      if (data.user) applyUser(data.user)
      if (data.agencies) setGroups(data.agencies)
      setForm(emptyForm)
      showToast(
        "ok",
        data.previewUrl
          ? "Agency created. Welcome mail is in the local inbox."
          : `Agency ${data.user?.email || "account"} created.`
      )
      router.refresh()
    } catch (err) {
      const text = err instanceof Error ? err.message : "Could not create agency"
      setError(text)
      showToast("err", text)
    } finally {
      setPending(false)
    }
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault()
    if (!editing) return
    setBusyId(editing.id)
    setError(null)
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editing.id,
          name: editForm.name,
          email: editForm.email,
          company: editForm.company,
          plan: editForm.plan,
          extraCampaigns: editForm.plan === "agency" ? editForm.extraCampaigns : 0,
          ...(editForm.clearTrial
            ? { clearTrial: true }
            : editForm.applyTrial
              ? { trialAmount: editForm.trialAmount, trialUnit: editForm.trialUnit }
              : {}),
        }),
      })
      const data = (await response.json()) as { error?: string; user?: AdminUserRow }
      if (!response.ok) throw new Error(data.error || "Could not update agency")
      if (data.user) applyUser(data.user)
      setEditing(null)
      showToast("ok", `${data.user?.email || editForm.email} updated.`)
      router.refresh()
    } catch (err) {
      const text = err instanceof Error ? err.message : "Could not update agency"
      setError(text)
      showToast("err", text)
    } finally {
      setBusyId(null)
    }
  }

  async function setSuspended(user: AdminUserRow, suspend: boolean) {
    if (suspend) {
      if (
        !window.confirm(
          `Suspend ${user.name} (${user.email})? They can still sign in to billing and account, but the tracker and scans will lock — even if a trial or Paddle subscription is current.`
        )
      ) {
        return
      }
    }
    setBusyId(user.id)
    setError(null)
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, status: suspend ? "suspended" : "active" }),
      })
      const data = (await response.json()) as { error?: string; user?: AdminUserRow }
      if (!response.ok) throw new Error(data.error || "Could not update status")
      if (data.user) applyUser(data.user)
      showToast("ok", suspend ? `${user.email} is suspended.` : `${user.email} is active again.`)
      router.refresh()
    } catch (err) {
      const text = err instanceof Error ? err.message : "Could not update status"
      setError(text)
      showToast("err", text)
    } finally {
      setBusyId(null)
    }
  }

  async function deleteGroup(agency: Group) {
    if (
      !window.confirm(
        `Delete the agency group “${agency.name}”? Accounts in that group are unassigned. A leftover GridPin or Taylor Agency owner account is removed; other users stay.`
      )
    ) {
      return
    }
    setBusyId(`group:${agency.id}`)
    setError(null)
    try {
      const response = await fetch(`/api/admin/agencies?agencyId=${encodeURIComponent(agency.id)}`, {
        method: "DELETE",
      })
      const data = (await response.json()) as {
        error?: string
        agencies?: Group[]
        accounts?: AdminUserRow[]
        purgedUsers?: { userId: string; email: string }[]
      }
      if (!response.ok) throw new Error(data.error || "Could not delete agency group")
      if (data.agencies) setGroups(data.agencies)
      else setGroups((current) => current.filter((item) => item.id !== agency.id))
      if (data.accounts) {
        setRows(data.accounts)
      } else if (data.purgedUsers?.length) {
        const purged = new Set(data.purgedUsers.map((item) => item.userId))
        setRows((current) => current.filter((row) => !purged.has(row.id)))
      }
      const purgedNote = data.purgedUsers?.length
        ? ` Removed ${data.purgedUsers.map((item) => item.email).join(", ")}.`
        : ""
      showToast("ok", `Group “${agency.name}” deleted.${purgedNote}`)
      router.refresh()
    } catch (err) {
      const text = err instanceof Error ? err.message : "Could not delete agency group"
      setError(text)
      showToast("err", text)
    } finally {
      setBusyId(null)
    }
  }

  function requestDeleteAgency(user: AdminUserRow) {
    if (user.id === currentUserId) {
      showToast("err", "You cannot delete your own account.")
      return
    }
    setError(null)
    setConfirmDelete(user)
  }

  async function deleteAgency(user: AdminUserRow) {
    if (user.id === currentUserId) {
      showToast("err", "You cannot delete your own account.")
      setConfirmDelete(null)
      return
    }
    setBusyId(user.id)
    setError(null)
    try {
      const response = await fetch(`/api/admin/users?userId=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || "Could not delete agency")
      setRows((current) => current.filter((row) => row.id !== user.id))
      if (editing?.id === user.id) setEditing(null)
      setConfirmDelete(null)
      showToast("ok", `${user.email} was deleted. That email can sign up again.`)
      router.refresh()
    } catch (err) {
      const text = err instanceof Error ? err.message : "Could not delete agency"
      setError(text)
      showToast("err", text)
    } finally {
      setBusyId(null)
    }
  }

  function openEdit(user: AdminUserRow) {
    setEditing(user)
    setEditForm({
      name: user.name,
      email: user.email,
      company: user.company,
      plan: user.plan,
      extraCampaigns: user.extraCampaigns,
      trialAmount: 7,
      trialUnit: "days",
      applyTrial: false,
      clearTrial: false,
    })
  }

  return (
    <section className="space-y-6">
      <form className="rounded-2xl border bg-card p-5" onSubmit={createAgency}>
        <h2 className="font-heading text-2xl">Agencies</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          An agency account is a user on the Pro (agency) plan. Add one with a password or an invite.
          A trial timer is the only free-use path — otherwise they stay locked until Paddle is
          active. They do not inherit admin Maps API keys.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              minLength={8}
              placeholder="Leave blank to send an invite"
            />
          </Field>
          <Field label="Agency / company">
            <Input
              value={form.company}
              onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
              placeholder="Defaults to the name"
            />
          </Field>
          <Field label="Plan">
            <select
              className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm"
              value={form.plan}
              onChange={(event) => {
                const plan = event.target.value as PlanId
                setForm((current) => ({
                  ...current,
                  plan,
                  extraCampaigns: plan === "agency" ? current.extraCampaigns : 0,
                }))
              }}
            >
              {PLAN_ORDER.map((id) => (
                <option key={id} value={id}>
                  {PLANS[id].name}
                </option>
              ))}
            </select>
          </Field>
          {form.plan === "agency" ? (
            <Field label="Extra campaigns">
              <Input
                type="number"
                min={0}
                max={MAX_EXTRA_CAMPAIGNS}
                value={form.extraCampaigns}
                onChange={(event) =>
                  setForm((current) => ({ ...current, extraCampaigns: Number(event.target.value) }))
                }
              />
            </Field>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Trial length">
            <Input
              type="number"
              min={0}
              className="w-24"
              value={form.trialAmount}
              onChange={(event) =>
                setForm((current) => ({ ...current, trialAmount: Number(event.target.value) }))
              }
            />
          </Field>
          <Field label="Unit">
            <select
              className="h-8 rounded-lg border bg-transparent px-2 text-sm"
              value={form.trialUnit}
              onChange={(event) =>
                setForm((current) => ({ ...current, trialUnit: event.target.value as TrialUnit }))
              }
            >
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </Field>
          <p className="max-w-sm pb-1 text-xs text-muted-foreground">
            0 means no software access until they pay. Hours or days start when you create the
            account.
          </p>
        </div>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-[var(--primary)]"
            checked={form.sendEmail}
            onChange={(event) =>
              setForm((current) => ({ ...current, sendEmail: event.target.checked }))
            }
          />
          Email them about this account
        </label>
        <Button className="mt-4" type="submit" disabled={pending}>
          {pending ? "Creating…" : "Add agency"}
        </Button>
      </form>

      {groups.length > 0 ? (
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="font-heading text-lg">Agency groups</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Name labels used to group accounts. Delete a group to unassign its members. A leftover
            GridPin or Taylor Agency owner account is removed; everyone else stays.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {groups.map((agency) => {
              const busy = busyId === `group:${agency.id}`
              return (
                <div key={agency.id} className="flex items-start justify-between gap-2 rounded-xl border px-3 py-2">
                  <div className="min-w-0">
                    <p className="font-medium">{agency.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {agency.userCount} account{agency.userCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="xs"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => deleteGroup(agency)}
                  >
                    {busy ? "Working…" : "Delete"}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-card p-5">
        <h3 className="font-heading text-lg">Agency accounts</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Pro-plan accounts. Suspend locks the tracker; they can still open billing.
        </p>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
        {rows.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No agency accounts yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {rows.map((user) => {
              const busy = busyId === user.id
              return (
                <li
                  key={user.id}
                  className="flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{user.name}</p>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        Agency
                      </span>
                      {user.status === "suspended" ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-950">
                          Suspended
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {user.agencyName} · {PLANS[user.plan].name}
                      {user.plan === "agency" && user.extraCampaigns > 0
                        ? ` · ${user.extraCampaigns} extra`
                        : ""}{" "}
                      · {formatTrial(user.trialEndsAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="xs" variant="outline" onClick={() => openEdit(user)}>
                      Edit
                    </Button>
                    {user.status === "suspended" ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setSuspended(user, false)}
                      >
                        {busy ? "Saving…" : "Unsuspend"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={busy}
                        onClick={() => setSuspended(user, true)}
                      >
                        {busy ? "Saving…" : "Suspend"}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="xs"
                      variant="destructive"
                      disabled={busy || user.id === currentUserId}
                      onClick={() => requestDeleteAgency(user)}
                    >
                      {busy ? "Working…" : "Delete"}
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={saveEdit}>
            <DialogHeader>
              <DialogTitle>Edit agency</DialogTitle>
              <DialogDescription>
                Change the owner name, email, company, plan, extra campaigns, or trial timer.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, name: event.target.value }))
                  }
                  required
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, email: event.target.value }))
                  }
                  required
                />
              </Field>
              <Field label="Company">
                <Input
                  value={editForm.company}
                  onChange={(event) =>
                    setEditForm((current) => ({ ...current, company: event.target.value }))
                  }
                />
              </Field>
              <Field label="Plan">
                <select
                  className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm"
                  value={editForm.plan}
                  onChange={(event) => {
                    const plan = event.target.value as PlanId
                    setEditForm((current) => ({
                      ...current,
                      plan,
                      extraCampaigns: plan === "agency" ? current.extraCampaigns : 0,
                    }))
                  }}
                >
                  {PLAN_ORDER.map((id) => (
                    <option key={id} value={id}>
                      {PLANS[id].name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Extra campaigns">
                <Input
                  type="number"
                  min={0}
                  max={MAX_EXTRA_CAMPAIGNS}
                  disabled={editForm.plan !== "agency"}
                  value={editForm.plan === "agency" ? editForm.extraCampaigns : 0}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      extraCampaigns: Number(event.target.value),
                    }))
                  }
                />
              </Field>
              <Field label="Trial length">
                <Input
                  type="number"
                  min={0}
                  value={editForm.trialAmount}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      trialAmount: Number(event.target.value),
                    }))
                  }
                />
              </Field>
              <Field label="Unit">
                <select
                  className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm"
                  value={editForm.trialUnit}
                  onChange={(event) =>
                    setEditForm((current) => ({
                      ...current,
                      trialUnit: event.target.value as TrialUnit,
                    }))
                  }
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </Field>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[var(--primary)]"
                checked={editForm.applyTrial}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    applyTrial: event.target.checked,
                    clearTrial: event.target.checked ? false : current.clearTrial,
                  }))
                }
              />
              Set a new trial timer
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[var(--primary)]"
                checked={editForm.clearTrial}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    clearTrial: event.target.checked,
                    applyTrial: event.target.checked ? false : current.applyTrial,
                  }))
                }
              />
              Clear trial
            </label>
            <p className="mt-2 text-xs text-muted-foreground">
              Current trial: {formatTrial(editing?.trialEndsAt)}. Leave both unchecked to keep it.
            </p>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busyId === editing?.id}>
                {busyId === editing?.id ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(confirmDelete)} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this account?</DialogTitle>
            <DialogDescription>
              {confirmDelete
                ? `Delete ${confirmDelete.name} (${confirmDelete.email})? Their account, campaigns, brands, scans, and local billing rows will be removed. They can sign up again with this email. Other people in the same agency group are not deleted.`
                : "This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!confirmDelete || busyId === confirmDelete.id}
              onClick={() => confirmDelete && void deleteAgency(confirmDelete)}
            >
              {confirmDelete && busyId === confirmDelete.id ? "Working…" : "Delete account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2">
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
    </section>
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
