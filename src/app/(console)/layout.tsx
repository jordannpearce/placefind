import { redirect } from "next/navigation"

import { AppNav } from "@/components/app-nav"
import { requireUser } from "@/lib/auth-guard"

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  if (!user) redirect("/login")
  return (
    <div className="flex min-h-svh flex-col">
      <AppNav name={user.name} role={user.role} />
      <div className="flex-1">{children}</div>
    </div>
  )
}
