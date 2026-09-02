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
  isAdmin,
  impersonating,
}: {
  name: string
  isAdmin: boolean
  impersonating: { name: string; email: string } | null
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" })
    router.push("/")
    router.refresh()
  }

  async function stopViewing() {
    await fetch("/api/admin/impersonate", { method: "DELETE" })
    router.push("/admin")
    router.refresh()
  }

  return (
    <header className="border-b bg-background">
      {impersonating ? (
        <div className="bg-amber-100 px-4 py-2 text-sm text-amber-950">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2">
            <p>
              Viewing as <span className="font-medium">{impersonating.name}</span>{" "}
              <span className="text-amber-900/80">({impersonating.email})</span>
            </p>
            <Button type="button" size="xs" variant="outline" onClick={stopViewing}>
              Back to admin
            </Button>
          </div>
        </div>
      ) : null}
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="font-heading text-xl tracking-tight">
            GridPins
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
            {isAdmin ? (
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
