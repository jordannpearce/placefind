export type AppPath = "/" | "/sell" | "/download"

export function currentPath(): AppPath {
  const path = window.location.pathname
  if (path.startsWith("/sell")) return "/sell"
  if (path.startsWith("/download")) return "/download"
  return "/"
}
