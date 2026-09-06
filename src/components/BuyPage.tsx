import type { AuthUser } from "../lib/types.ts"

type Props = {
  user: AuthUser | null
  onAuthed?: (user: AuthUser) => void
  onTryScan?: () => void
}

export function BuyPage({ onTryScan }: Props) {
  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-line bg-panel p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">PlaceFind</p>
      <h2 className="mt-2 font-display text-3xl text-paper">Join the directory</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        PlaceFind no longer sells a boxed product. Create a free account to add your business listing.
      </p>
      {onTryScan && (
        <button type="button" onClick={onTryScan} className="mt-5 text-sm text-brass hover:underline">
          Open the test scan
        </button>
      )}
    </section>
  )
}
