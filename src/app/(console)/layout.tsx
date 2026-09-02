import { redirect } from "next/navigation"

import { AppNav } from "@/components/app-nav"
import { requireAdmin, requireUser } from "@/lib/auth-guard"

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const acting = await requireUser()
  if (!acting) redirect("/login")
  const admin = await requireAdmin()
  const impersonating = Boolean(admin && admin.user.id !== acting.user.id)

  return (
    <div className="flex min-h-svh flex-col">
      <AppNav
        name={acting.user.name}
        isAdmin={Boolean(admin)}
        impersonating={
          impersonating
            ? { name: acting.user.name, email: acting.user.email }
            : null
        }
      />
      <div className="flex-1">{children}</div>
    </div>
  )
}
