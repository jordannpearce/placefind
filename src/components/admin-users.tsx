"use client"

import { Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MAX_EXTRA_CAMPAIGNS, PLANS, PLAN_ORDER } from "@/lib/plans"
import { blankCampaign, uniqueCampaignName } from "@/lib/storage"
import type { Agency, Campaign, PlanId, PublicUser, UserRole, UserStatus } from "@/lib/types"

export type AdminUserRow = PublicUser & { campaignCount: number; agencyName: string }

type Toast = { id: number; kind: "ok" | "err"; text: string }

export function AdminUsers({
  users,
  agencies,
  currentUserId,
}: {
  users: AdminUserRow[]
  agencies: Agency[]
  currentUserId: string
}) {
  const router = useRouter()
  const [rows, setRows] = useState(users)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pending, setPending] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [managing, setManaging] = useState<AdminUserRow | null>(null)
  const [managedCampaigns, setManagedCampaigns] = useState<Campaign[]>([])
  const [managedActiveId, setManagedActiveId] = useState("")
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    company: "",
    agencyName: "",
    plan: "starter" as PlanId,
    extraCampaigns: 0,
    role: "user" as UserRole,
    status: "active" as UserStatus,
    marketingOptIn: false,
    sendEmail: true,
  })

  function showToast(kind: Toast["kind"], text: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current, { id, kind, text }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4500)
  }

  function canDelete(user: AdminUserRow) {
    if (user.id === currentUserId) return false
    const activeAdmins = rows.filter((row) => row.role === "admin" && row.status === "active")
    if (user.role === "admin" && user.status === "active" && activeAdmins.length <= 1) return false
    return true
  }

  async function patch(
    userId: string,
    body: {
      status?: UserStatus
      plan?: PlanId
      extraCampaigns?: number
      role?: UserRole
      agencyId?: string
      marketingOptIn?: boolean
    }
  ) {
    setError(null)
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...body }),
    })
    const data = (await response.json()) as { error?: string; user?: AdminUserRow }
    if (!response.ok) {
      setError(data.error || "Update failed")
      return
    }
    setRows((current) =>
      current.map((row) => (row.id === userId && data.user ? { ...row, ...data.user } : row))
    )
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = (await response.json()) as { error?: string; user?: AdminUserRow; previewUrl?: string | null }
      if (!response.ok) throw new Error(data.error || "Could not create user")
      if (data.user) setRows((current) => [data.user!, ...current])
      setForm({
        name: "",
        email: "",
        password: "",
        company: "",
        agencyName: "",
        plan: "starter",
        extraCampaigns: 0,
        role: "user",
        status: "active",
        marketingOptIn: false,
        sendEmail: true,
      })
      setMessage(
        data.previewUrl
          ? "User created. The welcome email is in the local inbox because Resend is not configured."
          : "User created."
      )
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create user")
    } finally {
      setPending(false)
    }
  }

  async function openCampaigns(user: AdminUserRow) {
    setError(null)
    setManaging(user)
    setCampaignsLoading(true)
    try {
      const response = await fetch(`/api/admin/workspace?userId=${encodeURIComponent(user.id)}`)
      const data = (await response.json()) as {
        error?: string
        campaigns?: Campaign[]
        activeCampaignId?: string
      }
      if (!response.ok) throw new Error(data.error || "Could not load campaigns")
      setManagedCampaigns(data.campaigns ?? [])
      setManagedActiveId(data.activeCampaignId ?? "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load campaigns")
      setManaging(null)
    } finally {
      setCampaignsLoading(false)
    }
  }

  async function persistManaged(next: Campaign[], activeCampaignId = managedActiveId) {
    if (!managing) return
    setError(null)
    const nextActive = next.some((campaign) => campaign.id === activeCampaignId)
      ? activeCampaignId
      : (next[0]?.id ?? "")
    const response = await fetch(`/api/admin/workspace?userId=${encodeURIComponent(managing.id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaigns: next, activeCampaignId: nextActive }),
    })
    const data = (await response.json()) as { error?: string; campaigns?: Campaign[] }
    if (!response.ok) {
      setError(data.error || "Could not update campaigns")
      return
    }
    const saved = data.campaigns ?? next
    setManagedCampaigns(saved)
    setManagedActiveId(nextActive)
    setRows((current) =>
      current.map((row) => (row.id === managing.id ? { ...row, campaignCount: saved.length } : row))
    )
  }

  async function renameManaged(id: string, name: string) {
    const next = managedCampaigns.map((campaign) =>
      campaign.id === id ? { ...campaign, name } : campaign
    )
    setManagedCampaigns(next)
    await persistManaged(next)
  }

  async function deleteManaged(id: string) {
    if (!window.confirm("Delete this campaign? This cannot be undone.")) return
    await persistManaged(managedCampaigns.filter((campaign) => campaign.id !== id))
  }

  async function addBlankManaged() {
    const campaign = {
      ...blankCampaign(),
      name: uniqueCampaignName("New campaign", managedCampaigns),
    }
    await persistManaged([...managedCampaigns, campaign])
  }

  async function deleteUser(user: AdminUserRow) {
    if (!canDelete(user)) {
      showToast(
        "err",
        user.id === currentUserId ? "You cannot delete your own account." : "Cannot delete the last admin."
      )
      return
    }
    if (
      !window.confirm(
        `Delete ${user.name} (${user.email})? Their account, campaigns, scans, and local billing rows will be removed. They can sign up again with this email.`
      )
    ) {
      return
    }
    if (user.role === "admin") {
      if (!window.confirm(`This is an admin account. Delete ${user.name} anyway?`)) return
    }
    setDeletingId(user.id)
    setError(null)
    try {
      const response = await fetch(`/api/admin/users?userId=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) throw new Error(data.error || "Could not delete user")
      setRows((current) => current.filter((row) => row.id !== user.id))
      if (managing?.id === user.id) setManaging(null)
      showToast("ok", `${user.email} was deleted. That email can sign up again.`)
      router.refresh()
    } catch (err) {
      const text = err instanceof Error ? err.message : "Could not delete user"
      setError(text)
      showToast("err", text)
    } finally {
      setDeletingId(null)
    }
  }

  async function viewAs(userId: string) {
    setError(null)
    const response = await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    })
    const data = (await response.json()) as { error?: string }
    if (!response.ok) {
      setError(data.error || "Could not open that account")
      return
    }
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <form className="rounded-2xl border bg-card p-5" onSubmit={createUser}>
        <h2 className="font-heading text-2xl">Add a user</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create an account immediately. Active users can sign in with the password you set. Pending
          users get an activation email first.
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
              required
            />
          </Field>
          <Field label="Company">
            <Input
              value={form.company}
              onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
            />
          </Field>
          <Field label="Agency">
            <Input
              list="agency-names"
              value={form.agencyName}
              onChange={(event) => setForm((current) => ({ ...current, agencyName: event.target.value }))}
              placeholder="Taylor Agency"
            />
            <datalist id="agency-names">
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.name} />
              ))}
            </datalist>
          </Field>
          <div className="grid grid-cols-3 gap-2">
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
            <Field label="Role">
              <select
                className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm"
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Status">
              <select
                className="h-8 w-full rounded-lg border bg-transparent px-2 text-sm"
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({ ...current, status: event.target.value as UserStatus }))
                }
              >
                <option value="active">Active</option>
                <option value="pending">Pending</option>
              </select>
            </Field>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-[var(--primary)]"
              checked={form.marketingOptIn}
              onChange={(event) =>
                setForm((current) => ({ ...current, marketingOptIn: event.target.checked }))
              }
            />
            Opt in to marketing
          </label>
          {form.plan === "agency" ? (
            <label className="flex items-center gap-2">
              Extra slots
              <input
                type="number"
                min={0}
                max={MAX_EXTRA_CAMPAIGNS}
                className="h-8 w-16 rounded-lg border bg-transparent px-2"
                value={form.extraCampaigns}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    extraCampaigns: Number(event.target.value),
                  }))
                }
              />
              <span className="text-muted-foreground">$5 each, 0–{MAX_EXTRA_CAMPAIGNS}</span>
            </label>
          ) : null}
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-[var(--primary)]"
              checked={form.sendEmail}
              onChange={(event) => setForm((current) => ({ ...current, sendEmail: event.target.checked }))}
            />
            Email them about this account
          </label>
        </div>
        <Button className="mt-4" type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create user"}
        </Button>
      </form>

      <div className="overflow-x-auto rounded-2xl border">
        {error ? <p className="px-4 py-2 text-sm text-destructive">{error}</p> : null}
        {message ? <p className="px-4 py-2 text-sm text-emerald-800">{message}</p> : null}
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/70 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Account</th>
              <th className="px-3 py-2 font-medium">Agency</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Extras</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Mail</th>
              <th className="px-3 py-2 font-medium">Campaigns</th>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">View</th>
              <th className="px-3 py-2 font-medium">Delete</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="px-3 py-2">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-[11px] text-muted-foreground">{user.email}</p>
                </td>
                <td className="px-3 py-2">
                  <select
                    className="h-8 max-w-[160px] rounded-lg border bg-transparent px-2"
                    value={user.agencyId}
                    onChange={(event) => patch(user.id, { agencyId: event.target.value })}
                  >
                    {agencies.map((agency) => (
                      <option key={agency.id} value={agency.id}>
                        {agency.name}
                      </option>
                    ))}
                    {!agencies.some((agency) => agency.id === user.agencyId) ? (
                      <option value={user.agencyId}>{user.agencyName}</option>
                    ) : null}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    className="h-8 rounded-lg border bg-transparent px-2"
                    value={user.plan}
                    onChange={(event) =>
                      patch(user.id, {
                        plan: event.target.value as PlanId,
                        extraCampaigns: event.target.value === "agency" ? user.extraCampaigns : 0,
                      })
                    }
                  >
                    {PLAN_ORDER.map((id) => (
                      <option key={id} value={id}>
                        {PLANS[id].name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    max={MAX_EXTRA_CAMPAIGNS}
                    disabled={user.plan !== "agency"}
                    className="h-8 w-16 rounded-lg border bg-transparent px-2 disabled:opacity-40"
                    value={user.plan === "agency" ? user.extraCampaigns : 0}
                    onChange={(event) =>
                      patch(user.id, { extraCampaigns: Number(event.target.value) })
                    }
                    aria-label={`Extra campaign slots for ${user.name}`}
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    className="h-8 rounded-lg border bg-transparent px-2"
                    value={user.status}
                    onChange={(event) => patch(user.id, { status: event.target.value as UserStatus })}
                  >
                    <option value="pending">Pending</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="accent-[var(--primary)]"
                      checked={user.marketingOptIn}
                      onChange={(event) => patch(user.id, { marketingOptIn: event.target.checked })}
                    />
                    Marketing
                  </label>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span>{user.campaignCount}</span>
                    <Button type="button" size="xs" variant="outline" onClick={() => openCampaigns(user)}>
                      Manage
                    </Button>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    onClick={() => patch(user.id, { role: user.role === "admin" ? "user" : "admin" })}
                  >
                    {user.role}
                  </Button>
                </td>
                <td className="px-3 py-2">
                  <Button type="button" size="xs" onClick={() => viewAs(user.id)}>
                    View as user
                  </Button>
                </td>
                <td className="px-3 py-2">
                  {canDelete(user) ? (
                    <Button
                      type="button"
                      size="xs"
                      variant="destructive"
                      disabled={deletingId === user.id || pending}
                      onClick={() => deleteUser(user)}
                    >
                      {deletingId === user.id ? "Deleting…" : "Delete"}
                    </Button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      {user.id === currentUserId ? "You" : "Last admin"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(managing)} onOpenChange={(open) => !open && setManaging(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Campaigns · {managing?.name}</DialogTitle>
            <DialogDescription>
              List, rename, delete, or add a blank campaign for this account. Plan limits do not apply
              to admin edits. Use View as user to open their tracker.
            </DialogDescription>
          </DialogHeader>
          {campaignsLoading ? (
            <p className="text-sm text-muted-foreground">Loading campaigns…</p>
          ) : (
            <div className="space-y-3">
              {managedCampaigns.length === 0 ? (
                <p className="rounded-xl border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
                  No campaigns. Add a blank campaign to give this account an empty workspace.
                </p>
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto">
                  {managedCampaigns.map((campaign) => (
                    <li key={campaign.id} className="flex items-center gap-2">
                      <Input
                        value={campaign.name}
                        onChange={(event) =>
                          setManagedCampaigns((current) =>
                            current.map((item) =>
                              item.id === campaign.id ? { ...item, name: event.target.value } : item
                            )
                          )
                        }
                        onBlur={(event) => renameManaged(campaign.id, event.target.value)}
                        aria-label={`Rename ${campaign.name}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`Delete ${campaign.name}`}
                        onClick={() => deleteManaged(campaign.id)}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <Button type="button" variant="outline" onClick={addBlankManaged}>
                <Plus />
                Add blank campaign
              </Button>
            </div>
          )}
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
    </div>
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
