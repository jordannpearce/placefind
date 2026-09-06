import { isLegalPath } from "./legal.ts"
import type { AuthUser } from "./types.ts"

export type AppPath =
  | "/"
  | "/track"
  | "/sell"
  | "/download"
  | "/buy"
  | "/account"
  | "/login"
  | "/join"
  | "/admin"
  | "/reset"
  | "/try"
  | "/demo"
  | "/directory"
  | "/dashboard"
  | "/listings"
  | "/terms"
  | "/privacy"
  | "/policy"
  | "/email-policy"
  | "/data-policy"
  | "/refund"

export type NavAccess = {
  desktop: boolean
  store: boolean
  admin: boolean
  user: AuthUser | null
  impersonating?: { name: string; email: string } | null
}

export type NavLink = {
  href: string
  label: string
}

const PATHS: AppPath[] = [
  "/",
  "/track",
  "/sell",
  "/download",
  "/buy",
  "/account",
  "/login",
  "/join",
  "/admin",
  "/reset",
  "/try",
  "/demo",
  "/directory",
  "/dashboard",
  "/listings",
  "/terms",
  "/privacy",
  "/policy",
  "/email-policy",
  "/data-policy",
  "/refund",
]

export function listingIdFromPath(pathname = typeof window === "undefined" ? "/" : window.location.pathname): string | null {
  const match = pathname.match(/^\/listings\/([^/]+)/)
  if (!match || match[1] === "new") return null
  return match[1]
}

export function isListingCreatePath(pathname = typeof window === "undefined" ? "/" : window.location.pathname): boolean {
  return pathname === "/listings/new" || pathname === "/listings/new/"
}

export function isListingEditPath(pathname = typeof window === "undefined" ? "/" : window.location.pathname): boolean {
  return /^\/listings\/[^/]+\/edit\/?$/.test(pathname)
}

export function currentPath(): AppPath {
  const path = window.location.pathname
  if (path.startsWith("/track") || path.startsWith("/campaigns")) return "/track"
  if (path.startsWith("/sell")) return "/sell"
  if (path.startsWith("/download")) return "/download"
  if (path.startsWith("/buy")) return "/buy"
  if (path.startsWith("/account")) return "/account"
  if (path.startsWith("/login")) return "/login"
  if (path.startsWith("/join")) return "/join"
  if (path.startsWith("/admin")) return "/admin"
  if (path.startsWith("/reset")) return "/reset"
  if (path.startsWith("/try")) return "/try"
  if (path.startsWith("/demo")) return "/demo"
  if (path.startsWith("/directory")) return "/directory"
  if (path.startsWith("/dashboard")) return "/dashboard"
  if (path.startsWith("/listings")) return "/listings"
  if (path.startsWith("/terms")) return "/terms"
  if (path.startsWith("/privacy")) return "/privacy"
  if (path.startsWith("/policy")) return "/policy"
  if (path.startsWith("/email-policy")) return "/email-policy"
  if (path.startsWith("/data-policy")) return "/data-policy"
  if (path.startsWith("/refund")) return "/refund"
  return "/"
}

export function clientIsDesktop(): boolean {
  return Boolean(window.placefindDesktop?.isDesktop)
}

export function isAppPath(path: string): path is AppPath {
  return PATHS.includes(path as AppPath)
}

export function allowedPath(next: AppPath, access: NavAccess): AppPath {
  const { desktop, admin, user, impersonating } = access
  if (isLegalPath(next)) return next
  if (next === "/admin") return impersonating ? (user ? "/account" : "/") : "/admin"
  if (next === "/reset") return "/reset"
  if (next === "/sell") return admin ? "/sell" : impersonating ? "/account" : "/admin"
  if (next === "/join") return user ? "/account" : "/join"
  if (next === "/directory" || next === "/listings") return next
  if (next === "/dashboard") return user ? "/dashboard" : "/login"
  if (next === "/try" || next === "/demo") {
    if (desktop && !user) return "/login"
    return next
  }
  if (desktop && !user) return "/login"
  if (next === "/track") return desktop && !user ? "/login" : "/track"
  if (next === "/account") return user ? "/account" : "/login"
  if (next === "/login") return user ? (desktop ? "/" : "/account") : "/login"
  if (next === "/download" || next === "/buy") return desktop && !user ? "/login" : "/"
  if (next === "/") return "/"
  return "/"
}

export function navLinks(access: NavAccess): NavLink[] {
  const { desktop, admin, user } = access
  if (desktop && !user) return []

  if (desktop) {
    const links: NavLink[] = [
      { href: "/", label: "Lookup" },
      { href: "/track", label: "Track" },
    ]
    if (user) links.push({ href: "/account", label: "Account" })
    if (admin) links.push({ href: "/admin", label: "Admin" })
    return links
  }

  const links: NavLink[] = [
    { href: "/", label: "Home" },
    { href: "/directory", label: "Directory" },
  ]
  if (!user) links.push({ href: "/#how-it-works", label: "How it works" })
  if (user) {
    links.push({ href: "/listings/new", label: "Create listing" }, { href: "/dashboard", label: "Crawl" })
    links.push({ href: "/account", label: "Account" })
  } else {
    links.push({ href: "/join", label: "Join" }, { href: "/login", label: "Sign in" })
  }
  if (admin) links.push({ href: "/admin", label: "Admin" })
  return links
}

export function pageTitle(path: AppPath): string {
  if (path === "/") return "PlaceFind — Local business directory"
  if (path === "/directory") return "Directory · PlaceFind"
  if (path === "/dashboard") return "Crawl Website · PlaceFind"
  if (path === "/listings") return "Listing · PlaceFind"
  if (path === "/try" || path === "/demo") return "Test scan · PlaceFind"
  if (path === "/join") return "Join · PlaceFind"
  if (path === "/login") return "Sign in · PlaceFind"
  if (path === "/track") return "Track · PlaceFind"
  if (path === "/terms") return "Terms of use · PlaceFind"
  if (path === "/privacy" || path === "/policy") return "Privacy policy · PlaceFind"
  if (path === "/email-policy") return "Email policy · PlaceFind"
  if (path === "/data-policy") return "Data policy · PlaceFind"
  if (path === "/refund") return "Refund policy · PlaceFind"
  return "PlaceFind"
}
