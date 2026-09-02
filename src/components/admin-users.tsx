"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import type { PlanId, PublicUser, UserStatus } from "@/lib/types"

type Row = PublicUser & { campaignCount: number }

export function AdminUsers({ users }: { users: Row[] }) {
  const [rows, setRows] = useState(users)
  const [error, setError] = useState<string | null>(null)

  async function patch(userId: string, body: { status?: UserStatus; plan?: PlanId; role?: "user" | "admin" }) {
    setError(null)
    const response = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...body }),
    })
    const data = (await response.json()) as { error?: string; user?: PublicUser }
    if (!response.ok) {
      setError(data.error || "Update failed")
      return
    }
    setRows((current) =>
      current.map((row) => (row.id === userId && data.user ? { ...row, ...data.user } : row))
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border">
      {error ? <p className="px-4 py-2 text-sm text-destructive">{error}</p> : null}
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/70 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Account</th>
            <th className="px-3 py-2 font-medium">Plan</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Campaigns</th>
            <th className="px-3 py-2 font-medium">Role</th>
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
                  className="h-8 rounded-lg border bg-transparent px-2"
                  value={user.plan}
                  onChange={(event) => patch(user.id, { plan: event.target.value as PlanId })}
                >
                  <option value="starter">Starter</option>
                  <option value="agency">Agency</option>
                  <option value="enterprise">Enterprise</option>
                </select>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
