import Link from "next/link"

import { buttonVariants } from "@/components/ui/button"
import { requireUser } from "@/lib/auth-guard"
import { formatWhen, isCampaignDue } from "@/lib/storage"
import { PLANS } from "@/lib/plans"

export default async function DashboardPage() {
  const auth = await requireUser()
  if (!auth) return null
  const { user, workspace } = auth
  const plan = PLANS[user.plan]
  const due = workspace.campaigns.filter((campaign) => isCampaignDue(campaign))

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Workspace
          </p>
          <h1 className="font-heading text-4xl tracking-tight">Hello, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.company || user.email} · {plan.name} plan · {workspace.campaigns.length}/{plan.campaigns}{" "}
            campaigns
          </p>
        </div>
        <Link href="/track" className={buttonVariants({ size: "lg" })}>
          Open tracker
        </Link>
      </div>

      {due.length > 0 ? (
        <div className="mt-6 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-950">
          {due.length} campaign{due.length === 1 ? "" : "s"} due for a scheduled ranking check.
        </div>
      ) : null}

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Campaigns" value={String(workspace.campaigns.length)} />
        <Stat
          label="Keywords tracked"
          value={String(workspace.campaigns.reduce((sum, campaign) => sum + campaign.keywords.length, 0))}
        />
        <Stat label="Plan" value={plan.name} />
      </div>

      <h2 className="mt-10 font-heading text-2xl">Campaigns</h2>
      {workspace.campaigns.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No campaigns yet. Open the tracker to add a brand and location.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {workspace.campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              href="/track"
              className="rounded-2xl border bg-card p-4 hover:border-foreground/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{campaign.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {campaign.businessName} · {campaign.businessCity}, {campaign.businessState}
                  </p>
                </div>
                {isCampaignDue(campaign) ? (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-950">
                    Due
                  </span>
                ) : null}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {campaign.keywords.join(", ")} · {campaign.gridSize}×{campaign.gridSize} · last scan{" "}
                {formatWhen(campaign.lastScanAt)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="font-heading text-3xl">{value}</p>
    </div>
  )
}
