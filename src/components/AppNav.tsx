import type { AuthUser } from "../lib/types.ts"
import type { AppPath } from "../lib/nav.ts"

type Props = {
  path: AppPath
  store: boolean
  admin: boolean
  user: AuthUser | null
  onGo: (path: AppPath) => void
}

export function AppNav({ path, store, admin, user, onGo }: Props) {
  const links: { href: AppPath; label: string }[] = [
    { href: "/", label: store ? "Test scan" : "Lookup" },
    { href: "/track", label: "Track" },
  ]
  if (store) {
    links.push({ href: "/buy", label: "Buy" }, { href: "/download", label: "Download" })
    if (user) {
      links.push({ href: "/account", label: "Account" })
    } else {
      links.push({ href: "/join", label: "Join" }, { href: "/login", label: "Sign in" })
    }
  }
  if (admin) {
    links.push({ href: "/sell", label: "Sell" }, { href: "/admin", label: "Admin" })
  }

  return (
    <nav className="flex flex-wrap items-center gap-1">
      {links.map((link) => {
        const active = path === link.href
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
