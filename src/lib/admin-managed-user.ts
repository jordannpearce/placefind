import { ACTIVATION_TOKEN_TTL_MS, createHashedToken } from "@/lib/auth-tokens"
import { findOrCreateAgency, findOrCreateWorkspace, type Database } from "@/lib/db"
import {
  accountCreatedEmail,
  accountInviteEmail,
  activationEmail,
  appUrl,
} from "@/lib/email-templates"
import { previewUrl, sendAuthMail } from "@/lib/mail"
import { hashPassword, randomToken } from "@/lib/password"
import { provisionUserFromPaddle } from "@/lib/paddle-fulfillment"
import { defaultAiVisibilityFields } from "@/lib/ai-visibility"
import { clampExtraCampaigns, isPlanId, PLANS } from "@/lib/plans"
import { defaultScanQuotaFields, scanQuotaSnapshot, setExtraScanCredits, usesHostedMaps } from "@/lib/scan-quota"
import type { PlanId, User, UserRole, UserStatus } from "@/lib/types"

export type CreateManagedUserInput = {
  name: string
  email: string
  password?: string
  company?: string
  agencyName?: string
  plan?: PlanId | string
  extraCampaigns?: number
  extraScanCredits?: number
  role?: UserRole | string
  status?: UserStatus | string
  marketingOptIn?: boolean
  trialEndsAt?: string | null
  defaultPlan?: PlanId
}

export type CreateManagedUserResult =
  | { ok: true; user: User; invite: boolean; inviteToken: string; activationToken: string }
  | { ok: false; error: "duplicate" }

/** Admin-created tester or agency account. Never copies admin DataForSEO keys. */
export function createManagedUser(db: Database, input: CreateManagedUserInput): CreateManagedUserResult {
  const email = input.email.trim().toLowerCase()
  if (db.users.some((item) => item.email === email)) return { ok: false, error: "duplicate" }

  const password = input.password || ""
  const invite = !password
  const status: UserStatus = invite
    ? "pending"
    : input.status === "pending" || input.status === "suspended"
      ? input.status
      : "active"
  const defaultPlan = input.defaultPlan && isPlanId(input.defaultPlan) ? input.defaultPlan : "starter"
  const plan: PlanId = isPlanId(input.plan) && PLANS[input.plan] ? input.plan : defaultPlan
  const agency = findOrCreateAgency(db, input.agencyName?.trim() || input.company?.trim() || input.name)
  const created: User = {
    id: `user_${Date.now()}`,
    name: input.name.trim(),
    email,
    passwordHash: hashPassword(invite ? randomToken() : password),
    role: input.role === "admin" ? "admin" : "user",
    status,
    plan,
    extraCampaigns: 0,
    ...defaultScanQuotaFields(),
    marketingOptIn: Boolean(input.marketingOptIn),
    company: input.company?.trim() || agency.name,
    agencyId: agency.id,
    paddleCustomerId: "",
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
    dfsLogin: "",
    dfsPassword: "",
    trialEndsAt: input.trialEndsAt ?? null,
    ...defaultAiVisibilityFields(),
  }
  created.extraCampaigns = clampExtraCampaigns(created.plan, input.extraCampaigns)
  if (input.extraScanCredits !== undefined) setExtraScanCredits(created, input.extraScanCredits)
  db.users.push(created)
  provisionUserFromPaddle(db, created)
  findOrCreateWorkspace(db, created.id)

  let inviteToken = ""
  let activationToken = ""
  if (invite) {
    inviteToken = createHashedToken(db, created.id, "reset", ACTIVATION_TOKEN_TTL_MS)
  } else if (status === "pending") {
    activationToken = createHashedToken(db, created.id, "activation", ACTIVATION_TOKEN_TTL_MS)
  }
  return { ok: true, user: created, invite, inviteToken, activationToken }
}

export function serializeAdminUsers(db: Database) {
  const agencies = Object.fromEntries(db.agencies.map((agency) => [agency.id, agency.name]))
  return db.users.map((user) => {
    const { passwordHash: _hash, dfsPassword, dfsLogin, ...rest } = user
    const hosted = usesHostedMaps(user)
    return {
      ...rest,
      dfsLogin: hosted ? "" : dfsLogin,
      hasDfsPassword: hosted ? false : Boolean(dfsPassword),
      usesHostedMaps: hosted,
      scanQuota: scanQuotaSnapshot(user),
      agencyName: (user.agencyId && agencies[user.agencyId]) || "Independent",
      campaignCount: db.workspaces[user.id]?.campaigns.length ?? 0,
    }
  })
}

export async function sendManagedUserWelcome(
  result: Extract<CreateManagedUserResult, { ok: true }>,
  sendEmail: boolean
): Promise<string | null> {
  const { user, invite, inviteToken, activationToken } = result
  if (!invite && !sendEmail) return null
  if (invite) {
    const setPasswordUrl = `${appUrl()}/reset-password?token=${inviteToken}`
    const template = accountInviteEmail(user.name, user.email, setPasswordUrl, user.trialEndsAt)
    const mail = await sendAuthMail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      kind: "account_created",
      userId: user.id,
    })
    return mail.provider === "preview" ? previewUrl(mail.id) : null
  }
  if (user.status === "pending") {
    const verifyUrl = `${appUrl()}/verify?token=${activationToken}`
    const template = activationEmail(user.name, verifyUrl)
    const mail = await sendAuthMail({
      to: user.email,
      subject: template.subject,
      html: template.html,
      kind: "activation",
      userId: user.id,
    })
    return mail.provider === "preview" ? previewUrl(mail.id) : null
  }
  const template = accountCreatedEmail(user.name, user.email, user.trialEndsAt)
  const mail = await sendAuthMail({
    to: user.email,
    subject: template.subject,
    html: template.html,
    kind: "account_created",
    userId: user.id,
  })
  return mail.provider === "preview" ? previewUrl(mail.id) : null
}
