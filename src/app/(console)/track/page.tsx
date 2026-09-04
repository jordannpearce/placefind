import { TrackerApp } from "@/components/tracker-app"
import { requireSoftwareAccessOrRedirect } from "@/lib/billing-gate"

export default async function TrackPage() {
  await requireSoftwareAccessOrRedirect()
  return <TrackerApp />
}
