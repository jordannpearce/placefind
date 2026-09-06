import { LoaderCircle } from "lucide-react"
import { useMemo, useState } from "react"
import { accountKindOf } from "../lib/account.ts"
import { createAdminUser, deleteAdminUser, impersonateAdminUser, setAdminUserStatus, updateAdminUser } from "../lib/api.ts"
import type { AccountKind, AuthUser, DirectoryListing } from "../lib/types.ts"

type Draft = {
  name: string
  email: string
  password: string
  role: "customer" | "admin"
  kind: AccountKind
}

const emptyDraft = (): Draft => ({ name: "", email: "", password: "", role: "customer", kind: "business" })

function formatCreated(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

type Props = {
  users: AuthUser[]
  listings?: DirectoryListing[]
  currentUserId?: string
  onUsers: (users: AuthUser[] | ((current: AuthUser[]) => AuthUser[])) => void
  onListings?: (listings: DirectoryListing[] | ((current: DirectoryListing[]) => DirectoryListing[])) => void
  onError: (message: string | null) => void
  onMessage: (message: string | null) => void
  onViewAs: (user: AuthUser) => void
}

export function AdminUsers({ users, listings = [], currentUserId, onUsers, onListings, onError, onMessage, onViewAs }: Props) {
  const [createDraft, setCreateDraft] = useState<Draft>(emptyDraft)
  const [editId, setEditId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Draft>(emptyDraft)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended">("all")
  const [roleFilter, setRoleFilter] = useState<"all" | "customer" | "admin">("all")

  const listingCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const listing of listings) {
      const owner = listing.ownerUserId
      if (!owner) continue
      counts.set(owner, (counts.get(owner) ?? 0) + 1)
    }
    return counts
  }, [listings])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return [...users]
      .filter((row) => {
        if (statusFilter !== "all" && row.status !== statusFilter) return false
        if (roleFilter !== "all" && row.role !== roleFilter) return false
        if (!needle) return true
        return `${row.name} ${row.email}`.toLowerCase().includes(needle)
      })
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }, [users, query, statusFilter, roleFilter])

  function replaceUser(next: AuthUser) {
    onUsers((current) => current.map((row) => (row.id === next.id ? next : row)))
  }

  async function run(key: string, work: () => Promise<void>) {
    setBusy(key)
    onError(null)
    onMessage(null)
    try {
      await work()
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not update users.")
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Users</p>
      <h2 className="mt-1 font-display text-3xl text-paper">Manage accounts</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        Add, edit, suspend, or delete customer and admin accounts. Business accounts can list a shop for $150 per
        month. Neighbor accounts are free for reviews and quotes. Suspended accounts cannot sign in. Deleting an
        account also removes that owner’s listings, crawls, and usage. Use View as user to open the site as that
        customer.
      </p>

      <form
        className="mt-5 grid gap-3 rounded-xl border border-line bg-ink p-4 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          void run("create", async () => {
            const user = await createAdminUser(createDraft)
            onUsers((current) => [user, ...current.filter((row) => row.id !== user.id)])
            setCreateDraft(emptyDraft())
            onMessage(`Created ${user.email}.`)
          })
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted md:col-span-2">Create user</p>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Name</span>
          <input
            value={createDraft.name}
            onChange={(event) => setCreateDraft({ ...createDraft, name: event.target.value })}
            className="h-11 rounded-lg border border-line bg-panel px-3 text-paper outline-none focus:border-brass"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Email</span>
          <input
            type="email"
            value={createDraft.email}
            onChange={(event) => setCreateDraft({ ...createDraft, email: event.target.value })}
            className="h-11 rounded-lg border border-line bg-panel px-3 text-paper outline-none focus:border-brass"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Password</span>
          <input
            type="password"
            value={createDraft.password}
            onChange={(event) => setCreateDraft({ ...createDraft, password: event.target.value })}
            autoComplete="new-password"
            className="h-11 rounded-lg border border-line bg-panel px-3 text-paper outline-none focus:border-brass"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Role</span>
          <select
            value={createDraft.role}
            onChange={(event) => setCreateDraft({ ...createDraft, role: event.target.value as Draft["role"] })}
            className="h-11 rounded-lg border border-line bg-panel px-3 text-paper outline-none focus:border-brass"
          >
            <option value="customer">Customer</option>
            <option value="admin">Admin</option>
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Account type</span>
          <select
            value={createDraft.kind}
            onChange={(event) => setCreateDraft({ ...createDraft, kind: event.target.value as Draft["kind"] })}
            className="h-11 rounded-lg border border-line bg-panel px-3 text-paper outline-none focus:border-brass"
          >
            <option value="business">Business (listing)</option>
            <option value="member">Neighbor (reviews & quotes)</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={busy === "create"}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brass font-semibold text-ink hover:bg-[#ecc77a] disabled:opacity-60 md:col-span-2"
        >
          {busy === "create" && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {busy === "create" ? "Creating…" : "Create user"}
        </button>
      </form>

      <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Search accounts</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name or email"
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Role</span>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}
            className="h-11 rounded-lg border border-line bg-ink px-3 text-paper outline-none focus:border-brass"
          >
            <option value="all">All</option>
            <option value="customer">Customers</option>
            <option value="admin">Admins</option>
          </select>
        </label>
      </div>

      <div className="mt-6 overflow-x-auto">
        {users.length === 0 ? (
          <p className="text-sm text-muted">No users yet. Create one above.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">No accounts match that search.</p>
        ) : (
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                <th className="pb-2 pr-3">Name</th>
                <th className="pb-2 pr-3">Email</th>
                <th className="pb-2 pr-3">Role</th>
                <th className="pb-2 pr-3">Type</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Listings</th>
                <th className="pb-2 pr-3">Created</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const editing = editId === row.id
                const self = row.id === currentUserId
                return (
                  <tr key={row.id} className="border-t border-line align-top">
                    <td className="py-3 pr-3 text-paper">
                      {editing ? (
                        <input
                          value={editDraft.name}
                          onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
                          className="h-10 w-full rounded-lg border border-line bg-ink px-2 text-paper outline-none focus:border-brass"
                        />
                      ) : (
                        row.name
                      )}
                    </td>
                    <td className="py-3 pr-3 text-paper">
                      {editing ? (
                        <input
                          type="email"
                          value={editDraft.email}
                          onChange={(event) => setEditDraft({ ...editDraft, email: event.target.value })}
                          className="h-10 w-full rounded-lg border border-line bg-ink px-2 text-paper outline-none focus:border-brass"
                        />
                      ) : (
                        row.email
                      )}
                    </td>
                    <td className="py-3 pr-3 capitalize text-paper/80">
                      {editing ? (
                        <select
                          value={editDraft.role}
                          onChange={(event) => setEditDraft({ ...editDraft, role: event.target.value as Draft["role"] })}
                          className="h-10 rounded-lg border border-line bg-ink px-2 text-paper outline-none focus:border-brass"
                        >
                          <option value="customer">Customer</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        row.role
                      )}
                    </td>
                    <td className="py-3 pr-3 text-paper/80">
                      {editing ? (
                        <select
                          value={editDraft.kind}
                          onChange={(event) => setEditDraft({ ...editDraft, kind: event.target.value as Draft["kind"] })}
                          className="h-10 rounded-lg border border-line bg-ink px-2 text-paper outline-none focus:border-brass"
                        >
                          <option value="business">Business</option>
                          <option value="member">Neighbor</option>
                        </select>
                      ) : accountKindOf(row) === "member" ? (
                        "Neighbor"
                      ) : (
                        "Business"
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <span className={row.status === "suspended" ? "text-clay" : "text-moss"}>
                        {row.status === "suspended" ? "Suspended" : "Active"}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-paper/80">{listingCounts.get(row.id) ?? 0}</td>
                    <td className="py-3 pr-3 text-xs text-muted">{formatCreated(row.createdAt)}</td>
                    <td className="py-3">
                      {editing ? (
                        <div className="grid gap-2">
                          <input
                            type="password"
                            value={editDraft.password}
                            onChange={(event) => setEditDraft({ ...editDraft, password: event.target.value })}
                            placeholder="New password (optional)"
                            autoComplete="new-password"
                            className="h-10 rounded-lg border border-line bg-ink px-2 text-paper outline-none focus:border-brass"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={busy === `save-${row.id}`}
                              onClick={() =>
                                void run(`save-${row.id}`, async () => {
                                  const user = await updateAdminUser(row.id, {
                                    name: editDraft.name,
                                    email: editDraft.email,
                                    role: editDraft.role,
                                    kind: editDraft.kind,
                                    ...(editDraft.password ? { password: editDraft.password } : {}),
                                  })
                                  replaceUser(user)
                                  setEditId(null)
                                  onMessage(`Updated ${user.email}.`)
                                })
                              }
                              className="rounded-lg bg-brass px-3 py-1.5 text-xs font-semibold text-ink hover:bg-[#ecc77a]"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditId(null)}
                              className="rounded-lg border border-line px-3 py-1.5 text-xs text-paper/80"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {row.role !== "admin" && (
                            <button
                              type="button"
                              disabled={busy === `view-${row.id}`}
                              onClick={() =>
                                void run(`view-${row.id}`, async () => {
                                  onViewAs(await impersonateAdminUser(row.id))
                                })
                              }
                              className="rounded-lg border border-brass px-3 py-1.5 text-xs font-semibold text-brass hover:bg-brass/10 disabled:opacity-40"
                            >
                              View as user
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setConfirmDelete(null)
                              setEditId(row.id)
                              setEditDraft({
                                name: row.name,
                                email: row.email,
                                password: "",
                                role: row.role,
                                kind: accountKindOf(row),
                              })
                            }}
                            className="rounded-lg border border-line px-3 py-1.5 text-xs text-paper/80 hover:border-brass"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={self || busy === `status-${row.id}`}
                            onClick={() =>
                              void run(`status-${row.id}`, async () => {
                                const next = row.status === "suspended" ? "active" : "suspended"
                                replaceUser(await setAdminUserStatus(row.id, next))
                                onMessage(next === "suspended" ? `Suspended ${row.email}.` : `Reactivated ${row.email}.`)
                              })
                            }
                            className="rounded-lg border border-line px-3 py-1.5 text-xs text-paper/80 hover:border-brass disabled:opacity-40"
                          >
                            {row.status === "suspended" ? "Unsuspend" : "Suspend"}
                          </button>
                          {confirmDelete === row.id ? (
                            <span className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="text-clay">
                                Delete this account{(listingCounts.get(row.id) ?? 0) > 0 ? " and its listings" : ""}?
                              </span>
                              <button
                                type="button"
                                disabled={busy === `delete-${row.id}`}
                                onClick={() =>
                                  void run(`delete-${row.id}`, async () => {
                                    await deleteAdminUser(row.id)
                                    onUsers((current) => current.filter((item) => item.id !== row.id))
                                    onListings?.((current) => current.filter((item) => item.ownerUserId !== row.id))
                                    setConfirmDelete(null)
                                    onMessage(`Deleted ${row.email}.`)
                                  })
                                }
                                className="rounded-lg bg-clay px-3 py-1.5 font-semibold text-ink"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDelete(null)}
                                className="rounded-lg border border-line px-3 py-1.5 text-paper/80"
                              >
                                Cancel
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={self}
                              onClick={() => setConfirmDelete(row.id)}
                              className="rounded-lg border border-line px-3 py-1.5 text-xs text-clay hover:border-clay disabled:opacity-40"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
