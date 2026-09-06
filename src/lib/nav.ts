import type { AuthUser } from "./types.ts"

export type AppPath = "/" | "/track" | "/sell" | "/download" | "/buy" | "/account" | "/login" | "/join" | "/admin" | "/reset"

export type NavAccess = {
  desktop: boolean
  store: boolean
  admin: boolean
  user: AuthUser | null
  impersonating?: { name: string; email: string } | null
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
  return "/"
}

export function clientIsDesktop(): boolean {
  return Boolean(window.placefindDesktop?.isDesktop)
}

export function allowedPath(next: AppPath, access: NavAccess): AppPath {
  const { desktop, store, admin, user, impersonating } = access
  if (next === "/admin") return impersonating ? (user ? "/account" : "/") : "/admin"
  if (next === "/reset") return "/reset"
  if (next === "/sell") return admin ? "/sell" : impersonating ? "/account" : "/admin"
  if (next === "/join") {
    if (desktop) return user ? "/" : "/login"
    return store ? "/buy" : "/"
  }
  if (desktop && !user) return "/login"
  if (next === "/track") return desktop && !user ? "/login" : "/track"
  if (next === "/account") return user ? "/account" : "/login"
  if (next === "/login") return user ? (desktop ? "/" : "/account") : "/login"
  if (next === "/download") return !desktop && (admin || store) ? "/download" : desktop ? "/" : "/"
  if (next === "/buy") return !desktop && store ? "/buy" : desktop ? "/" : "/"
  if (next === "/") return "/"
  return "/"
}

export function navLinks(access: NavAccess): { href: AppPath; label: string }[] {
  const { desktop, store, admin, user } = access
  if (desktop && !user) return []

  const links: { href: AppPath; label: string }[] = [
    { href: "/", label: desktop ? "Lookup" : "Test scan" },
  ]

  if (!desktop || user) {
    links.push({ href: "/track", label: "Track" })
  }

  if (desktop) {
    if (user) links.push({ href: "/account", label: "Account" })
  } else if (store) {
    links.push({ href: "/buy", label: "Buy" }, { href: "/download", label: "Download" })
    links.push(user ? { href: "/account", label: "Account" } : { href: "/login", label: "Sign in" })
  }

  if (admin) {
    links.push({ href: "/sell", label: "Sell" }, { href: "/admin", label: "Admin" })
  }

  return links
}
