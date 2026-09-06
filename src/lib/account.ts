import type { AuthUser } from "./types.ts"

export type AccountKind = "business" | "member"
export type JoinIntent = "business" | "member"

export const MEMBER_LISTING_MESSAGE =
  "This account is for reviews and quotes. Listing a business is $150 per month on a business account."

export const MEMBER_WELCOME =
  "Your PlaceFind account is free. Leave reviews and request quotes. PlaceFind does not charge this account $150 — that fee is only for a business listing."

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

export function joinIntentFromSearch(search = ""): JoinIntent {
  const raw = search.startsWith("?") ? search.slice(1) : search
  const params = new URLSearchParams(raw)
  const value = (params.get("for") || params.get("intent") || "").trim().toLowerCase()
  if (value === "review" || value === "quote" || value === "member" || value === "neighbor") return "member"
  return "business"
}

export function safeAuthNext(next: string | null | undefined): string | null {
  if (!next) return null
  const trimmed = next.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.includes("://")) return null
  const path = trimmed.split("#")[0] ?? trimmed
  if (path === "/directory" || path === "/account") return path
  if (path.startsWith("/listings/") && !path.includes("..")) return path
  return null
}

export function joinHref(intent: JoinIntent = "business", next?: string | null): string {
  const params = new URLSearchParams()
  if (intent === "member") params.set("for", "review")
  const dest = safeAuthNext(next)
  if (dest) params.set("next", dest)
  const query = params.toString()
  return query ? `/join?${query}` : "/join"
}

export function loginHref(next?: string | null): string {
  const dest = safeAuthNext(next)
  return dest ? `/login?${new URLSearchParams({ next: dest }).toString()}` : "/login"
}

export function listBusinessHref(user: Pick<AuthUser, "role" | "accountKind"> | null | undefined): string {
  return user ? "/listings/new" : "/join"
}
