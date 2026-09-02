"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/track", label: "Tracker" },
  { href: "/account", label: "Account" },
]

export function AppNav({
  name,
  role,
}: {
  name: string
  role: "user" | "admin"
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/")
    router.refresh()
  }

  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="font-heading text-xl tracking-tight">
            GridPin
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-2.5 py-1.5",
                  pathname === link.href || pathname.startsWith(`${link.href}/`)
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {link.label}
              </Link>
            ))}
            {role === "admin" ? (
              <Link
                href="/admin"
                className={cn(
                  "rounded-lg px-2.5 py-1.5",
                  pathname.startsWith("/admin")
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Admin
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">{name}</span>
          <Button variant="outline" size="sm" onClick={logout}>
            Log out
          </Button>
        </div>
      </div>
    </header>
  )
}
