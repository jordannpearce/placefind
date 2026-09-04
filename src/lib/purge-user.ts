import type { AuthToken, PaddleCustomer, PaddleSubscription, User, UserWorkspace } from "./types"

type PurgeDb = {
  users: User[]
  tokens: AuthToken[]
  workspaces: Record<string, UserWorkspace>
  customers: PaddleCustomer[]
  subscriptions: PaddleSubscription[]
}

export type PurgeUserResult =
  | { ok: true; email: string; userId: string }
  | { ok: false; error: string; status: 400 | 404 }

function customerIdsOwnedBy(user: User, db: PurgeDb): Set<string> {
  const ids = new Set<string>()
  const ownId = user.paddleCustomerId.trim()
  if (ownId) ids.add(ownId)
  const email = user.email.trim().toLowerCase()
  for (const customer of db.customers) {
    const matchesId = Boolean(ownId && customer.customerId === ownId)
    const matchesEmail = customer.email.trim().toLowerCase() === email
    if (!matchesId && !matchesEmail) continue
    const claimedByOther = db.users.some(
      (item) => item.id !== user.id && item.paddleCustomerId === customer.customerId
    )
    if (!claimedByOther) ids.add(customer.customerId)
  }
  return ids
}

/**
 * Fully remove one account so the same email can sign up again.
 * Drops that user's workspace, tokens, and local Paddle mirror rows for their
 * customer id only. Leaves other users, agencies, mail, and app_settings.
 */
export function purgeUserAccount(db: PurgeDb, userId: string, actorUserId: string): PurgeUserResult {
  const id = userId.trim()
  if (!id) return { ok: false, error: "userId is required", status: 400 }
  if (id === actorUserId) {
    return { ok: false, error: "You cannot delete your own account.", status: 400 }
  }

  const user = db.users.find((item) => item.id === id)
  if (!user) return { ok: false, error: "User not found", status: 404 }

  if (user.role === "admin") {
    const remainingActiveAdmins = db.users.filter(
      (item) => item.id !== id && item.role === "admin" && item.status === "active"
    )
    if (remainingActiveAdmins.length === 0) {
      return { ok: false, error: "Cannot delete the last admin.", status: 400 }
    }
  }

  const customerIds = customerIdsOwnedBy(user, db)
  db.subscriptions = db.subscriptions.filter((row) => !customerIds.has(row.customerId))
  db.customers = db.customers.filter((row) => !customerIds.has(row.customerId))
  db.tokens = db.tokens.filter((token) => token.userId !== id)
  delete db.workspaces[id]
  db.users = db.users.filter((item) => item.id !== id)

  return { ok: true, email: user.email, userId: id }
}
