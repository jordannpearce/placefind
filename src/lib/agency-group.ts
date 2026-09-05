import { isAgencyAccount } from "./agency-account"
import { purgeUserAccount } from "./purge-user"
import type { Agency, AuthToken, PaddleCustomer, PaddleSubscription, User, UserWorkspace } from "./types"

const PROTECTED_ADMIN_EMAIL = "tmrapp1995@gmail.com"

/** Leftover demo/test group names TM asked to drop from Admin. */
const LEFTOVER_DEMO_GROUP_NAMES = new Set(["gridpin", "gridpins", "taylor agency"])

type AgencyGroupDb = {
  users: User[]
  tokens: AuthToken[]
  workspaces: Record<string, UserWorkspace>
  agencies: Agency[]
  customers: PaddleCustomer[]
  subscriptions: PaddleSubscription[]
}

export type DeleteAgencyGroupResult =
  | {
      ok: true
      agencyId: string
      name: string
      unassignedUserIds: string[]
      purgedUsers: { userId: string; email: string }[]
    }
  | { ok: false; error: string; status: 400 | 404 }

export function normalizeAgencyGroupName(name: string) {
  return name.trim().toLowerCase()
}

export function isLeftoverDemoAgencyGroupName(name: string) {
  return LEFTOVER_DEMO_GROUP_NAMES.has(normalizeAgencyGroupName(name))
}

function displayNamesOf(user: Pick<User, "name" | "company">) {
  return [user.name, user.company].map((value) => normalizeAgencyGroupName(value)).filter(Boolean)
}

/** Agency-plan leftover whose display name is GridPin / GridPins / Taylor Agency. */
export function isLeftoverDemoAgencyAccount(user: User) {
  if (user.email.trim().toLowerCase() === PROTECTED_ADMIN_EMAIL) return false
  if (!isAgencyAccount(user)) return false
  return displayNamesOf(user).some((name) => LEFTOVER_DEMO_GROUP_NAMES.has(name))
}

function leftoverNamesForGroup(groupName: string) {
  const normalized = normalizeAgencyGroupName(groupName)
  const names = new Set([normalized])
  if (normalized === "gridpin" || normalized === "gridpins") {
    names.add("gridpin")
    names.add("gridpins")
  }
  return names
}

function userMatchesDeletedGroupName(user: User, groupName: string) {
  const aliases = leftoverNamesForGroup(groupName)
  return displayNamesOf(user).some((name) => aliases.has(name))
}

function isProtectedAdmin(user: User, actorUserId: string) {
  return (
    user.id === actorUserId ||
    user.email.trim().toLowerCase() === PROTECTED_ADMIN_EMAIL ||
    user.id === "user_tm_admin"
  )
}

/**
 * Remove one agency group. Members are unassigned.
 * Leftover GridPin / Taylor Agency *accounts* (agency plan + matching display name)
 * are purged the same way as admin user delete. TM's admin is never deleted.
 */
export function deleteAgencyGroup(
  db: AgencyGroupDb,
  agencyId: string,
  actorUserId: string
): DeleteAgencyGroupResult {
  const id = agencyId.trim()
  if (!id) return { ok: false, error: "agencyId is required", status: 400 }

  const agency = db.agencies.find((item) => item.id === id)
  if (!agency) return { ok: false, error: "Agency group not found", status: 404 }

  const unassignedUserIds: string[] = []
  const purgedUsers: { userId: string; email: string }[] = []
  const members = db.users.filter((user) => user.agencyId === id)

  for (const user of members) {
    if (isProtectedAdmin(user, actorUserId)) {
      user.agencyId = ""
      unassignedUserIds.push(user.id)
      continue
    }

    const leftoverOwner =
      isLeftoverDemoAgencyAccount(user) ||
      (isAgencyAccount(user) &&
        isLeftoverDemoAgencyGroupName(agency.name) &&
        userMatchesDeletedGroupName(user, agency.name))

    if (leftoverOwner) {
      const purged = purgeUserAccount(db, user.id, actorUserId)
      if (purged.ok) {
        purgedUsers.push({ userId: purged.userId, email: purged.email })
        continue
      }
    }

    user.agencyId = ""
    unassignedUserIds.push(user.id)
  }

  db.agencies = db.agencies.filter((item) => item.id !== id)
  return { ok: true, agencyId: id, name: agency.name, unassignedUserIds, purgedUsers }
}

/** Drop leftover GridPin / Taylor Agency groups (and matching leftover agency accounts). */
export function deleteLeftoverDemoAgencyGroups(db: AgencyGroupDb, actorUserId: string) {
  const deletedGroups: DeleteAgencyGroupResult[] = []
  const leftoverGroups = db.agencies.filter((agency) => isLeftoverDemoAgencyGroupName(agency.name))
  for (const agency of leftoverGroups) {
    deletedGroups.push(deleteAgencyGroup(db, agency.id, actorUserId))
  }

  const leftoverAccounts = db.users.filter(isLeftoverDemoAgencyAccount)
  const purgedUsers: { userId: string; email: string }[] = []
  for (const user of leftoverAccounts) {
    const purged = purgeUserAccount(db, user.id, actorUserId)
    if (purged.ok) purgedUsers.push({ userId: purged.userId, email: purged.email })
  }

  return { deletedGroups, purgedUsers }
}
