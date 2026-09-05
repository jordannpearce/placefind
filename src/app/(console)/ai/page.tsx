import { redirect } from "next/navigation"

import { AiVisibilityApp } from "@/components/ai-visibility-app"
import { requireUser } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"
import { billingPathForUser, userHasSoftwareAccess } from "@/lib/paddle-access"

export default async function AiVisibilityConsolePage() {
  const auth = await requireUser()
  if (!auth) return null
  const db = await readDb()
  if (!userHasSoftwareAccess(auth.user, db)) {
    redirect(billingPathForUser(auth.user, db))
  }
  return <AiVisibilityApp />
}
