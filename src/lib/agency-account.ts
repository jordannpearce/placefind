import type { PlanId, UserRole } from "./types"

/** Agency accounts are Pro-plan users. Admins on that plan are staff, not an agency owner. */
export function isAgencyAccount(user: { plan: PlanId; role: UserRole }) {
  return user.plan === "agency" && user.role !== "admin"
}
