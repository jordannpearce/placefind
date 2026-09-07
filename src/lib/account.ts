import type { AuthUser } from "./types.ts"

export type AccountKind = "business" | "member"
export type JoinIntent = "business" | "member"
export type UserStatus = "active" | "suspended" | "pending"

export const MEMBER_LISTING_MESSAGE =
  "This account is for reviews. Anyone can request a quote. Listing a business is $150 per month on a business account."

export const MEMBER_OWNER_TOOLS_MESSAGE =
  "This account is for reviews and quotes. Rank tracker, Traffic, and Create listing are for approved business accounts."

export const ACCOUNT_PENDING_MESSAGE =
  "This account is waiting for PlaceFind admin approval. You can sign in and browse the directory, but you cannot publish a listing, leave a review, or use owner tools until an admin approves it."

export const ACCOUNT_PENDING_REVIEW_MESSAGE =
  "This account is waiting for PlaceFind admin approval. You can browse the directory, but you cannot leave a review until an admin approves it."

export const ACCOUNT_HAS_LISTING_MESSAGE = "This account already has a listing."

export function parseAccountKind(value: unknown): AccountKind | null {
  if (value === "business" || value === "member") return value
  return null
}

export function accountKindOf(user: Pick<AuthUser, "role" | "accountKind"> | null | undefined): AccountKind {
  if (!user) return "member"
  if (user.role === "admin") return "business"
  return user.accountKind === "member" ? "member" : "business"
}

export function accountStatusOf(user: { status?: string } | null | undefined): UserStatus {
  if (user?.status === "suspended") return "suspended"
  if (user?.status === "pending") return "pending"
  return "active"
}

export function isApprovedAccount(
  user: Pick<AuthUser, "role" | "status"> | { role?: string; status?: string } | null | undefined,
): boolean {
  if (!user) return false
  const status = accountStatusOf(user)
  if (user.role === "admin") return status !== "suspended"
  return status === "active"
}

export function canPublishListing(
  user: Pick<AuthUser, "role" | "accountKind" | "status"> | null | undefined,
): boolean {
  return Boolean(user && isApprovedAccount(user) && accountKindOf(user) === "business")
}

export function canUseOwnerTools(
  user: Pick<AuthUser, "role" | "accountKind" | "status"> | null | undefined,
): boolean {
  return canPublishListing(user)
}

export function canUseRankTracker(
  user: Pick<AuthUser, "role" | "accountKind" | "status"> | null | undefined,
): boolean {
  return canUseOwnerTools(user)
}

export function canUseTraffic(
  user: Pick<AuthUser, "role" | "accountKind" | "status"> | null | undefined,
): boolean {
  return canUseOwnerTools(user)
}

export function canLeaveReview(
  user: Pick<AuthUser, "role" | "status"> | { role?: string; status?: string } | null | undefined,
): boolean {
  return isApprovedAccount(user)
}

export function listingCreateDenied(
  user: Pick<AuthUser, "role" | "accountKind" | "status"> | null | undefined,
): string | null {
  if (canPublishListing(user)) return null
  if (user && accountKindOf(user) === "member") return MEMBER_LISTING_MESSAGE
  if (user && !isApprovedAccount(user)) return ACCOUNT_PENDING_MESSAGE
  return MEMBER_LISTING_MESSAGE
}

export function ownerToolDenied(
  user: Pick<AuthUser, "role" | "accountKind" | "status"> | null | undefined,
): string | null {
  if (canUseOwnerTools(user)) return null
  if (user && accountKindOf(user) === "member") return MEMBER_OWNER_TOOLS_MESSAGE
  if (user && !isApprovedAccount(user)) return ACCOUNT_PENDING_MESSAGE
  return MEMBER_OWNER_TOOLS_MESSAGE
}

export type OwnedListingRef = {
  id: string
  slug?: string | null
}

export type ListingAccount = Pick<AuthUser, "role" | "accountKind" | "status" | "listingId" | "listingSlug">

export function ownedListingOf(user: ListingAccount | null | undefined): OwnedListingRef | null {
  const id = user?.listingId?.trim()
  if (!id) return null
  return { id, slug: user.listingSlug?.trim() || undefined }
}

export function editListingHref(owned: OwnedListingRef): string {
  const slug = owned.slug?.trim()
  return `/listings/${encodeURIComponent(slug || owned.id)}/edit`
}

export function showCreateListingCta(user: ListingAccount | null | undefined): boolean {
  return !user || canPublishListing(user)
}

export function listBusinessCtaLabel(
  user: ListingAccount | null | undefined,
  guestLabel: string,
  createLabel = "Create a listing",
): string {
  if (!user) return guestLabel
  if (user.role !== "admin" && ownedListingOf(user)) return "Edit your listing"
  return createLabel
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

export function listBusinessHref(user: ListingAccount | null | undefined): string {
  if (!user) return CREATE_PROFILE_PATH
  if (!canPublishListing(user)) return "/account"
  const owned = ownedListingOf(user)
  if (owned && user.role !== "admin") return editListingHref(owned)
  return "/listings/new"
}
