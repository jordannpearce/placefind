import { redirect } from "next/navigation"

import { AppNav } from "@/components/app-nav"
import { requireAdmin, requireUser } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"
import { userHasSoftwareAccess } from "@/lib/paddle-access"

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const acting = await requireUser()
  if (!acting) redirect("/login")
  const admin = await requireAdmin()
  const impersonating = Boolean(admin && admin.user.id !== acting.user.id)
  const db = await readDb()
  const softwareAccess = userHasSoftwareAccess(acting.user, db)

  return (
    <div className="flex min-h-svh flex-col">
      <AppNav
        name={acting.user.name}
        isAdmin={Boolean(admin)}
        softwareAccess={softwareAccess}
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
