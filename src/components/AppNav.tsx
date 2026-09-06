import type { AuthUser } from "../lib/types.ts"
import { navLinks, type AppPath } from "../lib/nav.ts"

type Props = {
  path: AppPath
  desktop: boolean
  store: boolean
  admin: boolean
  user: AuthUser | null
  onGo: (path: string) => void
}

export function AppNav({ path, desktop, store, admin, user, onGo }: Props) {
  const links = navLinks({ desktop, store, admin, user })

  if (links.length === 0) return null

  return (
    <nav className="flex flex-wrap items-center gap-1">
      {links.map((link) => {
        const pathname = window.location.pathname
        const active =
          link.href === pathname ||
          link.href === path ||
          (link.href.startsWith("/#") && path === "/") ||
          (link.href === "/listings/new" && pathname.startsWith("/listings")) ||
          (link.href === "/dashboard" && pathname.startsWith("/dashboard"))
        return (
          <a
            key={link.href}
            href={link.href}
            onClick={(event) => {
              event.preventDefault()
              onGo(link.href)
            }}
            className={`rounded-lg px-3 py-2 text-sm ${active ? "bg-raised text-brass" : "text-paper/80 hover:text-brass"}`}
          >
            {link.label}
          </a>
        )
      })}
    </nav>
  )
}
