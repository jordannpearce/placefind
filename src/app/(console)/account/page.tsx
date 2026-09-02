import { AccountForm } from "@/components/account-form"
import { requireUser } from "@/lib/auth-guard"
import { publicUser } from "@/lib/session"

export default async function AccountPage() {
  const auth = await requireUser()
  if (!auth) return null
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-heading text-4xl tracking-tight">Account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Profile, plan, DataForSEO keys, and email preferences. Changing plan sends a billing email.
      </p>
      <div className="mt-8">
        <AccountForm user={publicUser(auth.user)} />
      </div>
    </div>
  )
}
