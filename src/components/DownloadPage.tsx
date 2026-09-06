type Props = {
  onTryScan?: () => void
}

export function DownloadPage({ onTryScan }: Props) {
  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-line bg-panel p-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">PlaceFind</p>
      <h2 className="mt-2 font-display text-3xl text-paper">This page has been retired</h2>
      <p className="mt-3 text-sm leading-6 text-muted">
        PlaceFind is a web directory. Create an account to list your business, or browse listings on the site.
      </p>
      {onTryScan && (
        <button type="button" onClick={onTryScan} className="mt-5 text-sm text-brass hover:underline">
          Open the test scan
        </button>
      )}
    </section>
  )
}
