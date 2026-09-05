import Link from "next/link"
import { redirect } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import { requireUser } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"
import { billingPathForUser, userHasSoftwareAccess } from "@/lib/paddle-access"
import { usableCampaignLimit, PLANS, STARTER_INCLUDED_SCANS } from "@/lib/plans"
import { scanQuotaSnapshot, usesHostedMaps } from "@/lib/scan-quota"
import { formatWhen, isCampaignDue } from "@/lib/storage"

export default async function DashboardPage() {
  const auth = await requireUser()
  if (!auth) return null
  const db = await readDb()
  if (!userHasSoftwareAccess(auth.user, db)) {
    redirect(billingPathForUser(auth.user, db))
  }
  const { user, workspace } = auth
  const plan = PLANS[user.plan]
  const limit = usableCampaignLimit(user.plan, user.extraCampaigns, true)
  const due = workspace.campaigns.filter((campaign) => isCampaignDue(campaign))
  const hosted = usesHostedMaps(user)
  const quota = scanQuotaSnapshot(user)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Workspace
          </p>
          <h1 className="font-heading text-4xl tracking-tight">Hello, {user.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.company || user.email} · {plan.name} plan · {workspace.campaigns.length}/{limit}{" "}
            campaigns
            {user.plan === "agency" && user.extraCampaigns > 0
              ? ` · ${user.extraCampaigns} extra slot${user.extraCampaigns === 1 ? "" : "s"}`
              : ""}
            {hosted && quota.remaining != null
              ? ` · ${quota.remaining} scan${quota.remaining === 1 ? "" : "s"} left this month`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/track" className={buttonVariants({ size: "lg" })}>
            Open tracker
          </Link>
          <Link href="/ai" className={buttonVariants({ variant: "outline", size: "lg" })}>
            AI Visibility
          </Link>
        </div>
      </div>

      {due.length > 0 ? (
        <div className="mt-6 rounded-xl bg-amber-100 px-4 py-3 text-sm text-amber-950">
          {due.length} campaign{due.length === 1 ? "" : "s"} due for a scheduled ranking check.
        </div>
      ) : null}

      <div className={`mt-8 grid gap-3 ${hosted ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
        <Stat label="Campaigns" value={String(workspace.campaigns.length)} />
        <Stat
          label="Keywords tracked"
          value={String(workspace.campaigns.reduce((sum, campaign) => sum + campaign.keywords.length, 0))}
        />
        <Stat label="Plan" value={plan.name} />
        {hosted ? (
          <Stat
            label="Scans left"
            value={`${quota.remaining ?? 0}/${STARTER_INCLUDED_SCANS + quota.extraCredits}`}
          />
        ) : null}
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

      <section className="mt-12 rounded-2xl border bg-card p-5">
        <h2 className="font-heading text-2xl">AI Visibility</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Optional on every plan: $199 per month per brand. Type 10 prompts and scan each one 4
          times against ChatGPT, Perplexity, Gemini, Copilot, and Google AI Mode. History stays so
          you can compare whether the brand is still named.
        </p>
        <Link href="/ai" className={buttonVariants({ size: "sm", className: "mt-4" })}>
          Open AI Visibility
        </Link>
      </section>
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
