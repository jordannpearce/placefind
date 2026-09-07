import type { AuthUser } from "./types.ts"

export type AccountKind = "business" | "member"
export type JoinIntent = "business" | "member"

export const MEMBER_LISTING_MESSAGE =
  "This account is for reviews. Anyone can request a quote. Listing a business is $150 per month on a business account."

export function parseAccountKind(value: unknown): AccountKind | null {
  if (value === "business" || value === "member") return value
  return null
}

export function accountKindOf(user: Pick<AuthUser, "role" | "accountKind"> | null | undefined): AccountKind {
  if (!user) return "member"
  if (user.role === "admin") return "business"
  return user.accountKind === "member" ? "member" : "business"
}

export function canPublishListing(user: Pick<AuthUser, "role" | "accountKind"> | null | undefined): boolean {
  return Boolean(user && accountKindOf(user) === "business")
}

export function canUseOwnerTools(user: Pick<AuthUser, "role" | "accountKind"> | null | undefined): boolean {
  return canPublishListing(user)
}

export const JOIN_PATH = "/join"
export const CREATE_PROFILE_PATH = "/create-profile"

export function isCreateProfilePath(pathname = typeof window === "undefined" ? "/" : window.location.pathname): boolean {
  return (
    pathname === CREATE_PROFILE_PATH ||
    pathname === `${CREATE_PROFILE_PATH}/` ||
    pathname === "/join/business" ||
    pathname === "/join/business/"
  )
}

export function joinIntentFromSearch(search = ""): JoinIntent {
  const raw = search.startsWith("?") ? search.slice(1) : search
  const params = new URLSearchParams(raw)
  const value = (params.get("for") || params.get("intent") || "").trim().toLowerCase()
  if (value === "business" || value === "listing" || value === "owner" || value === "profile") return "business"
  return "member"
}

export function createProfileHref(next?: string | null): string {
  const dest = safeAuthNext(next)
  return dest ? `${CREATE_PROFILE_PATH}?${new URLSearchParams({ next: dest }).toString()}` : CREATE_PROFILE_PATH
}

export function afterSignupHref(kind: AccountKind, next?: string | null): string {
  return safeAuthNext(next) ?? (kind === "member" ? "/directory" : "/listings/new")
}

export function safeAuthNext(next: string | null | undefined): string | null {
  if (!next) return null
  const trimmed = next.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("://")) return null
  const path = trimmed.split("#")[0] ?? trimmed
  if (path === "/directory" || path === "/account" || path === "/pricing") return path
  if (path.startsWith("/listings/") && !path.includes("..")) return path
  return null
}

export function joinHref(intent: JoinIntent = "member", next?: string | null): string {
  if (intent === "business") return createProfileHref(next)
  const dest = safeAuthNext(next)
  return dest ? `${JOIN_PATH}?${new URLSearchParams({ next: dest }).toString()}` : JOIN_PATH
}

export function loginHref(next?: string | null): string {
  const dest = safeAuthNext(next)
  return dest ? `/login?${new URLSearchParams({ next: dest }).toString()}` : "/login"
}

export function listBusinessHref(user: Pick<AuthUser, "role" | "accountKind"> | null | undefined): string {
  return user ? "/listings/new" : CREATE_PROFILE_PATH
}
