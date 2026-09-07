import { accountKindOf, isApprovedAccount, MEMBER_OWNER_TOOLS_MESSAGE, ownerToolDenied } from "../lib/account.ts"
import type { AuthUser } from "../lib/types.ts"

type Props = {
  user: AuthUser
  compact?: boolean
}

export function PendingApprovalNotice({ user, compact }: Props) {
  const neighbor = accountKindOf(user) === "member"
  const title = neighbor ? "Your neighbor account is waiting for approval" : "Your business account is waiting for approval"
  const body = neighbor
    ? "You can sign in and browse the directory. An admin has to approve this account before you can leave a review."
    : "You can sign in and browse the directory. An admin has to approve this account before you can publish a listing or use Rank tracker, Traffic, or other owner tools."

  if (compact) {
    return (
      <div className="rounded-xl border border-brass/40 bg-brass/10 px-4 py-3">
        <p className="text-sm font-semibold text-paper">{title}</p>
        <p className="mt-1 text-sm leading-6 text-muted">{body}</p>
      </div>
    )
  }

  return (
    <section className="rounded-2xl border border-brass/40 bg-brass/10 p-6 sm:p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">Waiting for approval</p>
      <h2 className="mt-2 font-display text-3xl text-paper">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-muted">{body}</p>
      <p className="mt-3 text-sm leading-6 text-muted">
        PlaceFind will email {user.email} when an admin approves you. Until then, quotes stay open to anyone and listings
        already in the directory stay public.
      </p>
    </section>
  )
}

export function ToolAccessNotice({ user }: { user: AuthUser }) {
  if (accountKindOf(user) !== "member" && !isApprovedAccount(user)) {
    return <PendingApprovalNotice user={user} />
  }

  return (
    <section className="rounded-2xl border border-clay/40 bg-clay/10 p-6 sm:p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-clay">403</p>
      <h2 className="mt-2 font-display text-3xl text-paper">This account cannot use those tools</h2>
      <p className="mt-3 text-sm leading-6 text-muted">{ownerToolDenied(user) || MEMBER_OWNER_TOOLS_MESSAGE}</p>
    </section>
  )
}
