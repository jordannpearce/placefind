import { readDb } from "./db"
import { readSession } from "./session"
import type { User } from "./types"

export async function requireUser(): Promise<User | null> {
  const session = await readSession()
  if (!session) return null
  const user = readDb().users.find((item) => item.id === session.uid)
  if (!user || user.status !== "active") return null
  return user
}

export async function requireAdmin(): Promise<User | null> {
  const user = await requireUser()
  if (!user || user.role !== "admin") return null
  return user
}
