import { redirect } from "next/navigation"

import { findOrCreateWorkspace, readDb, updateDb } from "@/lib/db"
import { getImpersonatedUserId, readSession } from "@/lib/session"
import type { User, UserWorkspace } from "@/lib/types"

export type Authed = { user: User; workspace: UserWorkspace }

async function userWithWorkspace(user: User): Promise<Authed> {
  const db = await readDb()
  if (db.workspaces[user.id]) {
    return { user, workspace: db.workspaces[user.id] }
  }
  const workspace = await updateDb((next) => findOrCreateWorkspace(next, user.id))
  return { user, workspace }
}

/** The signed-in admin — ignores impersonation. */
export async function requireAdmin(): Promise<Authed | null> {
  const session = await readSession()
  if (!session) return null
  const db = await readDb()
  const user = db.users.find((item) => item.id === session.uid)
  // Admins keep /admin even if someone marked the row suspended.
  if (!user || user.role !== "admin") return null
  return userWithWorkspace(user)
}

function canActAsUser(user: User) {
  return user.status === "active" || user.status === "suspended"
}

/** The user the console should act as (may be impersonated). */
export async function requireUser(): Promise<Authed | null> {
  const session = await readSession()
  if (!session) return null
  const db = await readDb()
  const real = db.users.find((item) => item.id === session.uid)
  if (!real || !canActAsUser(real)) return null

  const asId = await getImpersonatedUserId()
  if (asId && real.role === "admin") {
    const target = db.users.find((item) => item.id === asId)
    if (target && canActAsUser(target)) {
      return userWithWorkspace(target)
    }
  }

  return userWithWorkspace(real)
}

export async function requireUserOrRedirect(): Promise<Authed> {
  const auth = await requireUser()
  if (!auth) redirect("/login")
  return auth
}

export async function requireAdminOrRedirect(): Promise<Authed> {
  const auth = await requireAdmin()
  if (!auth) redirect("/dashboard")
  return auth
}
