import { formatUsageRemaining, type AccountUsage } from "../lib/quotas.ts"

type Props = {
  usage: AccountUsage | null
  error?: string | null
  loading?: boolean
}

function MeterRow({ label, remaining }: { label: string; remaining: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 rounded-xl border border-line bg-ink px-4 py-3">
      <p className="text-sm text-paper">{label}</p>
      <p className="font-mono text-sm text-brass">{remaining}</p>
    </div>
  )
}

export function UsageCard({ usage, error, loading }: Props) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">This month</p>
      <h3 className="mt-2 font-display text-2xl text-paper">Monthly usage</h3>
      <p className="mt-2 text-sm text-muted">
        Remaining this calendar month (UTC). Rank scans, AI prompts, and traffic campaigns reset on the 1st.
      </p>
      {loading && <p className="mt-4 text-sm text-muted">Loading this month&apos;s usage…</p>}
      {error && <p className="mt-4 text-sm text-clay">{error}</p>}
      {!loading && !error && !usage && (
        <p className="mt-4 text-sm text-muted">Monthly usage is not available yet.</p>
      )}
      {usage && (
        <div className="mt-4 grid gap-3">
          {usage.unlimited ? (
            <p className="text-sm text-muted">This account is not capped this month.</p>
          ) : (
            <>
              <MeterRow label="Rank scans" remaining={formatUsageRemaining(usage.rankScans)} />
              <MeterRow label="AI prompts" remaining={formatUsageRemaining(usage.aiPrompts)} />
              <MeterRow label="Traffic" remaining={formatUsageRemaining(usage.trafficCampaigns)} />
            </>
          )}
        </div>
      )}
    </section>
  )
}
