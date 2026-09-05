"use client"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { UsStateSelect } from "@/components/us-state-select"
import type { AiBrand, PlanId, UserStatus } from "@/lib/types"

type AssignUser = {
  id: string
  name: string
  email: string
  company: string
  plan: PlanId
  status: UserStatus
  agencyId: string
}

type AssignAgency = {
  id: string
  name: string
  userCount: number
}

type AssignedBrand = AiBrand & {
  ownerUserId: string
  ownerName: string
  ownerEmail: string
  ownerCompany: string
  ownerPlan: PlanId
  agencyId: string
  agencyName: string
  complimentary: boolean
  quota: { remaining: number; included: number }
}

type Payload = {
  brands: AssignedBrand[]
  users: AssignUser[]
  agencies: AssignAgency[]
}

const emptyForm = {
  name: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  website: "",
  competitors: "",
  target: "user" as "user" | "agency",
  userId: "",
  agencyId: "",
}

export function AdminAiBrands({ initial }: { initial: Payload }) {
  const [payload, setPayload] = useState(initial)
  const [form, setForm] = useState(emptyForm)
  const [pending, setPending] = useState(false)
  const [removing, setRemoving] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const users = useMemo(
    () => payload.users.slice().sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name)),
    [payload.users]
  )
  const agencies = useMemo(
    () => payload.agencies.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [payload.agencies]
  )

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setPending(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/admin/ai-brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          street: form.street,
          city: form.city,
          state: form.state,
          zip: form.zip,
          phone: form.phone,
          website: form.website,
          competitors: form.competitors,
          userId: form.target === "user" ? form.userId : "",
          agencyId: form.target === "agency" ? form.agencyId : "",
        }),
      })
      const next = (await response.json()) as Payload & { error?: string; label?: string; granted?: unknown[] }
      if (!response.ok) throw new Error(next.error || "Could not assign the brand.")
      setPayload((current) => ({ ...current, brands: next.brands }))
      setMessage(
        `Assigned ${form.name.trim()} to ${next.label || "the selected account"}${
          Array.isArray(next.granted) && next.granted.length > 1 ? ` (${next.granted.length} accounts)` : ""
        }.`
      )
      setForm((current) => ({ ...emptyForm, target: current.target, userId: current.userId, agencyId: current.agencyId }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign the brand.")
    } finally {
      setPending(false)
    }
  }

  async function removeBrand(brand: AssignedBrand) {
    setRemoving(`${brand.ownerUserId}:${brand.id}`)
    setError("")
    try {
      const response = await fetch(
        `/api/admin/ai-brands?userId=${encodeURIComponent(brand.ownerUserId)}&brandId=${encodeURIComponent(brand.id)}`,
        { method: "DELETE" }
      )
      const next = (await response.json()) as Payload & { error?: string }
      if (!response.ok) throw new Error(next.error || "Could not remove the brand.")
      setPayload((current) => ({ ...current, brands: next.brands }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the brand.")
    } finally {
      setRemoving("")
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border bg-card p-5">
      <div>
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">AI Visibility</p>
        <h2 className="font-heading text-2xl">Create a brand and assign it</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Complimentary brands skip checkout. Assign to one user account or every account in an
          agency. Prompt scans on that workspace check the company name, street, phone, and website,
          and use city plus state for the local Maps location.
        </p>
      </div>

      <form onSubmit={(event) => void submit(event)} className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="admin-brand-name">Company name</Label>
          <Input
            id="admin-brand-name"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Acme Plumbing"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-brand-website">Website</Label>
          <Input
            id="admin-brand-website"
            value={form.website}
            onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
            placeholder="https://acmeplumbing.com"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="admin-brand-street">Street address</Label>
          <Input
            id="admin-brand-street"
            value={form.street}
            onChange={(event) => setForm((current) => ({ ...current, street: event.target.value }))}
            placeholder="1200 Congress Ave"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-brand-city">City</Label>
          <Input
            id="admin-brand-city"
            value={form.city}
            onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
            placeholder="Austin"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-brand-state">State</Label>
          <UsStateSelect
            id="admin-brand-state"
            value={form.state}
            onChange={(state) => setForm((current) => ({ ...current, state }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-brand-zip">ZIP</Label>
          <Input
            id="admin-brand-zip"
            value={form.zip}
            onChange={(event) => setForm((current) => ({ ...current, zip: event.target.value }))}
            placeholder="78701"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="admin-brand-phone">Phone number</Label>
          <Input
            id="admin-brand-phone"
            type="tel"
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            placeholder="(512) 555-0142"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="admin-brand-competitors">Competitors to watch</Label>
          <Textarea
            id="admin-brand-competitors"
            value={form.competitors}
            onChange={(event) => setForm((current) => ({ ...current, competitors: event.target.value }))}
            placeholder="Rival Plumbing, City Drain Co"
            rows={2}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label>Assign to</Label>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="brand-target"
                checked={form.target === "user"}
                onChange={() => setForm((current) => ({ ...current, target: "user" }))}
              />
              User account
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="brand-target"
                checked={form.target === "agency"}
                onChange={() => setForm((current) => ({ ...current, target: "agency" }))}
              />
              Agency
            </label>
          </div>
        </div>
        {form.target === "user" ? (
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="admin-brand-user">User account</Label>
            <select
              id="admin-brand-user"
              className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm"
              value={form.userId}
              onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}
            >
              <option value="">Choose a user…</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {(user.company || user.name) + " · " + user.email}
                  {user.status !== "active" ? ` (${user.status})` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="admin-brand-agency">Agency</Label>
            <select
              id="admin-brand-agency"
              className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm"
              value={form.agencyId}
              onChange={(event) => setForm((current) => ({ ...current, agencyId: event.target.value }))}
            >
              <option value="">Choose an agency…</option>
              {agencies.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.name} · {agency.userCount} account{agency.userCount === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </div>
        )}
        {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-800 md:col-span-2">{message}</p> : null}
        <div className="md:col-span-2">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Assigning…" : "Create and assign brand"}
          </Button>
        </div>
      </form>

      {payload.brands.length === 0 ? (
        <p className="text-sm text-muted-foreground">No AI Visibility brands assigned yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/70 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Brand</th>
                <th className="px-3 py-2 font-medium">Assigned to</th>
                <th className="px-3 py-2 font-medium">Agency</th>
                <th className="px-3 py-2 font-medium">Prompts</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {payload.brands.map((brand) => (
                <tr key={`${brand.ownerUserId}-${brand.id}`} className="border-t">
                  <td className="px-3 py-3">
                    <p className="font-medium">{brand.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {[brand.website || brand.domain, brand.phone, [brand.city, brand.state].filter(Boolean).join(", ")]
                        .filter(Boolean)
                        .join(" · ") || "No site"}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <p>{brand.ownerCompany || brand.ownerName}</p>
                    <p className="text-[11px] text-muted-foreground">{brand.ownerEmail}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">{brand.agencyName}</td>
                  <td className="px-3 py-3 text-xs">
                    {brand.quota.remaining}/{brand.quota.included}
                    {brand.complimentary ? (
                      <p className="text-[11px] text-muted-foreground">Complimentary</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    {brand.complimentary ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        disabled={removing === `${brand.ownerUserId}:${brand.id}`}
                        onClick={() => void removeBrand(brand)}
                      >
                        Remove
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Paid</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
