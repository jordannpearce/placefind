export type AppPath = "/" | "/track" | "/sell" | "/download" | "/buy" | "/account" | "/login" | "/join" | "/admin"

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
  return "/"
}
