import type { LicenseStatus } from "../lib/types.ts"

type Props = {
  license: LicenseStatus
  onActivated: (license: LicenseStatus) => void
}

export function LicenseGate({ onActivated }: Props) {
  return (
    <section className="mx-auto w-full max-w-xl rounded-2xl border border-line bg-panel p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">PlaceFind</p>
      <h2 className="mt-2 font-display text-3xl text-paper">Sign in to continue</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        PlaceFind uses your account. Create one to add listings and run more lookups.
      </p>
      <button
        type="button"
        onClick={() => onActivated({ required: false, configured: false, valid: true, keyHint: "", code: "", detail: "", expiry: null, seller: false })}
        className="mt-5 h-11 rounded-lg bg-brass px-4 font-semibold text-ink hover:bg-[#ecc77a]"
      >
        Continue
      </button>
    </section>
  )
}
