import type { AppPath } from "../lib/nav.ts"

const LINKS: { href: AppPath; label: string }[] = [
  { href: "/", label: "Lookup" },
  { href: "/sell", label: "Sell" },
  { href: "/download", label: "Download" },
]

type Props = {
  path: AppPath
  onGo: (path: AppPath) => void
}

export function AppNav({ path, onGo }: Props) {
  return (
    <nav className="flex flex-wrap items-center gap-1">
      {LINKS.map((link) => {
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
