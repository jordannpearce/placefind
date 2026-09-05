"use client"

import { useMemo, useState } from "react"

import {
  BrandProfileFields,
  emptyBrandProfileDraft,
  type BrandProfileDraft,
} from "@/components/brand-profile-fields"
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
import { Textarea } from "@/components/ui/textarea"
import { UsStateSelect } from "@/components/us-state-select"
import { PLANS } from "@/lib/plans"
import type { AiBrand, PlanId, UserStatus } from "@/lib/types"

type AssignUser = {
  id: string
  name: string
  email: string
  company: string
  plan: PlanId
  status: UserStatus
  agencyId: string
  softwareAccess?: boolean
}

function planLabel(plan: PlanId) {
  return PLANS[plan]?.name ?? plan
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
  const [savingEdit, setSavingEdit] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [editingKey, setEditingKey] = useState("")
  const [editDraft, setEditDraft] = useState<BrandProfileDraft>(emptyBrandProfileDraft)
  const [editError, setEditError] = useState("")
  const [editMessage, setEditMessage] = useState("")
  const [confirmDelete, setConfirmDelete] = useState<AssignedBrand | null>(null)

  const users = useMemo(
    () => payload.users.slice().sort((a, b) => (a.company || a.name).localeCompare(b.company || b.name)),
    [payload.users]
  )
  const agencies = useMemo(
    () => payload.agencies.slice().sort((a, b) => a.name.localeCompare(b.name)),
    [payload.agencies]
  )
  const selectedUser = users.find((user) => user.id === form.userId) ?? null
  const editingBrand = payload.brands.find((brand) => `${brand.ownerUserId}:${brand.id}` === editingKey) ?? null

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
        `Granted a free promotional brand (${form.name.trim()}, $0) to ${next.label || "the selected account"}${
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

  function startEdit(brand: AssignedBrand) {
    setEditingKey(`${brand.ownerUserId}:${brand.id}`)
    setEditDraft({
      name: brand.name,
      street: brand.street,
      city: brand.city,
      state: brand.state,
      zip: brand.zip,
      phone: brand.phone,
      website: brand.website,
      competitors: brand.competitors.map((item) => item.name).join(", "),
    })
    setEditError("")
    setEditMessage("")
    setError("")
  }

  async function saveEdit(brand: AssignedBrand) {
    setSavingEdit(true)
    setEditError("")
    setEditMessage("")
    try {
      if (editDraft.name.trim().length < 2) {
        throw new Error("Enter the company name.")
      }
      if (editDraft.city.trim().length < 2) {
        throw new Error("Enter the city.")
      }
      if (!editDraft.state.trim()) {
        throw new Error("Choose a state.")
      }
      const response = await fetch("/api/admin/ai-brands", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: brand.ownerUserId,
          brandId: brand.id,
          ...editDraft,
        }),
      })
      const next = (await response.json()) as Payload & { error?: string }
      if (!response.ok) throw new Error(next.error || "Could not update the brand.")
      setPayload((current) => ({ ...current, brands: next.brands }))
      const updated = next.brands.find((item) => item.id === brand.id && item.ownerUserId === brand.ownerUserId)
      if (updated) {
        setEditDraft({
          name: updated.name,
          street: updated.street,
          city: updated.city,
          state: updated.state,
          zip: updated.zip,
          phone: updated.phone,
          website: updated.website,
          competitors: updated.competitors.map((item) => item.name).join(", "),
        })
      }
      setEditMessage("Brand profile saved. City and state refreshed the local Maps location.")
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Could not update the brand.")
    } finally {
      setSavingEdit(false)
    }
  }

  async function removeBrand(brand: AssignedBrand) {
    setRemoving(`${brand.ownerUserId}:${brand.id}`)
    setError("")
    setMessage("")
    try {
      const response = await fetch(
        `/api/admin/ai-brands?userId=${encodeURIComponent(brand.ownerUserId)}&brandId=${encodeURIComponent(brand.id)}`,
        { method: "DELETE" }
      )
      const next = (await response.json()) as Payload & { error?: string }
      if (!response.ok) throw new Error(next.error || "Could not delete the brand.")
      setPayload((current) => ({ ...current, brands: next.brands }))
      if (editingKey === `${brand.ownerUserId}:${brand.id}`) {
        setEditingKey("")
        setEditError("")
        setEditMessage("")
      }
      setConfirmDelete(null)
      setMessage(
        brand.complimentary
          ? `${brand.name} was deleted from ${brand.ownerCompany || brand.ownerName}.`
          : `${brand.name} was removed from that workspace. AI Visibility access for this brand is gone here.`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the brand.")
    } finally {
      setRemoving("")
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border bg-card p-5">
      <div>
        <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">AI Visibility</p>
        <h2 className="font-heading text-2xl">Grant a free promotional brand</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Give any user account a free AI Visibility brand ($0, complimentary) for promotions,
          comps, or make-goods. This is not a paid Paddle checkout and does not require an existing
          AI Visibility subscription. Starter, Pro, Advanced, trial, complimentary software, and
          agency members are all eligible. Assign to one account or an entire agency (duplicates
          are skipped). Edit any brand below. Delete removes it from that workspace. Prompt scans
          check the company name, street, phone, and website, and use city plus state for the local
          Maps location.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Recipients still need GridPins software access (paid plan, complimentary software, or an
          open trial) to open /ai. You can still grant the brand to unpaid Starter or expired-trial
          accounts — they will see it once they have software access.
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
              Any user account — Starter, Pro, Advanced, trial, or agency member
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="brand-target"
                checked={form.target === "agency"}
                onChange={() => setForm((current) => ({ ...current, target: "agency" }))}
              />
              Agency — entire group
            </label>
          </div>
        </div>
        {form.target === "user" ? (
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="admin-brand-user">Account</Label>
            <select
              id="admin-brand-user"
              className="h-10 w-full rounded-lg border bg-transparent px-3 text-sm"
              value={form.userId}
              onChange={(event) => setForm((current) => ({ ...current, userId: event.target.value }))}
            >
              <option value="">Choose an account…</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {(user.company || user.name) + " · " + user.email + " · " + planLabel(user.plan)}
                  {user.status !== "active" ? ` (${user.status})` : ""}
                  {user.softwareAccess === false ? " · no software access yet" : ""}
                </option>
              ))}
            </select>
            {selectedUser && selectedUser.softwareAccess === false ? (
              <p className="text-sm text-muted-foreground">
                You can still grant this free promotional brand ($0). This account cannot open /ai
                until it has software access (paid plan, complimentary software, or an open trial).
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Starter, Pro, Advanced, trial, complimentary software, and agency members are all
                valid. No AI Visibility subscription required. Pending accounts stay blocked.
              </p>
            )}
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
            <p className="text-sm text-muted-foreground">
              Every account in the group receives the brand. Members who already have it are skipped.
            </p>
          </div>
        )}
        {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-800 md:col-span-2">{message}</p> : null}
        <div className="md:col-span-2">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Granting…" : "Grant free promotional brand"}
          </Button>
        </div>
      </form>

      {payload.brands.length === 0 ? (
        <p className="rounded-xl border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
          No AI Visibility brands yet. Use the form above to add one and assign it to a user or
          agency.
        </p>
      ) : (
        <div className="space-y-4">
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
                {payload.brands.map((brand) => {
                  const key = `${brand.ownerUserId}:${brand.id}`
                  return (
                    <tr key={`${brand.ownerUserId}-${brand.id}`} className="border-t">
                      <td className="px-3 py-3">
                        <p className="font-medium">{brand.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {[
                            brand.website || brand.domain,
                            brand.phone,
                            [brand.city, brand.state].filter(Boolean).join(", "),
                          ]
                            .filter(Boolean)
                            .join(" · ") || "No site"}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <p>{brand.ownerCompany || brand.ownerName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {brand.ownerEmail} · {planLabel(brand.ownerPlan)}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{brand.agencyName}</td>
                      <td className="px-3 py-3 text-xs">
                        {brand.quota.remaining}/{brand.quota.included}
                        {brand.complimentary ? (
                          <p className="text-[11px] text-muted-foreground">Free / promotional ($0)</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="xs"
                            variant={editingKey === key ? "default" : "outline"}
                            onClick={() => startEdit(brand)}
                          >
                            {editingKey === key ? "Editing" : "Edit"}
                          </Button>
                          <Button
                            type="button"
                            size="xs"
                            variant="destructive"
                            disabled={removing === key}
                            onClick={() => {
                              setError("")
                              setConfirmDelete(brand)
                            }}
                          >
                            {removing === key ? "Deleting…" : "Delete"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {editingBrand ? (
            <div className="space-y-3 rounded-2xl border bg-background p-4">
              <div>
                <h3 className="font-heading text-xl">Edit brand profile</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Update {editingBrand.name} on {editingBrand.ownerCompany || editingBrand.ownerName}.
                  City and state refresh the local Maps location.
                </p>
              </div>
              <BrandProfileFields
                idPrefix="admin-brand-edit"
                values={editDraft}
                onChange={setEditDraft}
                disabled={savingEdit}
              />
              {editError ? <p className="text-sm text-destructive">{editError}</p> : null}
              {editMessage ? <p className="text-sm text-emerald-800">{editMessage}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={savingEdit} onClick={() => void saveEdit(editingBrand)}>
                  {savingEdit ? "Saving…" : "Save brand"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingEdit}
                  onClick={() => {
                    setEditingKey("")
                    setEditError("")
                    setEditMessage("")
                  }}
                >
                  Close
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      <Dialog open={Boolean(confirmDelete)} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this brand?</DialogTitle>
            <DialogDescription>
              {confirmDelete
                ? confirmDelete.complimentary
                  ? `Delete ${confirmDelete.name} from ${confirmDelete.ownerCompany || confirmDelete.ownerName}? This complimentary brand will leave their AI Visibility list.`
                  : `Delete ${confirmDelete.name} from ${confirmDelete.ownerCompany || confirmDelete.ownerName}? This removes the brand from that workspace. Checkout is not cancelled here — access on this account is gone.`
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
              disabled={!confirmDelete || removing === `${confirmDelete.ownerUserId}:${confirmDelete.id}`}
              onClick={() => confirmDelete && void removeBrand(confirmDelete)}
            >
              {confirmDelete && removing === `${confirmDelete.ownerUserId}:${confirmDelete.id}`
                ? "Deleting…"
                : "Delete brand"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
