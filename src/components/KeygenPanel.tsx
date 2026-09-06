import type { InstallerStatus, IssuedLicense, KeygenStatus } from "../lib/types.ts"

type Props = {
  keygen: KeygenStatus | null
  issued: IssuedLicense[]
  installerRunning: boolean
  onKeygen: (keygen: KeygenStatus) => void
  onIssued: (issued: IssuedLicense[]) => void
  onInstaller: (installer: InstallerStatus) => void
  onError: (message: string | null) => void
}

export function KeygenPanel(_props: Props) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Retired</p>
      <h3 className="mt-1 font-display text-2xl text-paper">Account tools moved</h3>
      <p className="mt-2 text-sm leading-6 text-muted">
        PlaceFind no longer issues product codes. Manage users and directory listings on Admin.
      </p>
    </section>
  )
}
