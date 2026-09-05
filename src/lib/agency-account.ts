import type { PlanId, UserRole, UserStatus } from "./types"

/** Agency accounts are Pro-plan users. Admins on that plan are staff, not an agency owner. */
export function isAgencyAccount(user: { plan: PlanId; role: UserRole }) {
  return user.plan === "agency" && user.role !== "admin"
}

/** Paid Get Found leads go to Pro (`agency`) or Advanced (`enterprise`) agency accounts only. */
export function canReceivePaidLeads(user: {
  plan: PlanId
  role: UserRole
  status?: UserStatus | string
}) {
  if (user.role === "admin") return false
  if (user.status && user.status !== "active") return false
  return user.plan === "agency" || user.plan === "enterprise"
}
