"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MAX_EXTRA_CAMPAIGNS, PLANS, PLAN_ORDER } from "@/lib/plans"
import type { Agency, PlanId, PublicUser, UserRole, UserStatus } from "@/lib/types"

export type AdminUserRow = PublicUser & { campaignCount: number; agencyName: string }

export function AdminUsers({
  users,
  agencies,
}: {
  users: AdminUserRow[]
  agencies: Agency[]
}) {
  const router = useRouter()
  const [rows, setRows] = useState(users)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
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
                <td className="px-3 py-2">{user.campaignCount}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
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
