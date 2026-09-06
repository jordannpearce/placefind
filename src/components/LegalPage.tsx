import { legalPageFor } from "../lib/legal.ts"

type Props = {
  path: string
}

export function LegalPage({ path }: Props) {
  const page = legalPageFor(path)
  if (!page) return null

  return (
    <article className="mx-auto w-full max-w-3xl rounded-2xl border border-line bg-panel px-6 py-8 sm:px-10">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brass">PlaceFind</p>
      <h2 className="mt-2 font-display text-4xl text-paper">{page.title}</h2>
      <p className="mt-2 text-xs text-muted">Updated {page.updated}</p>
      <p className="mt-5 text-sm leading-7 text-paper/85">{page.intro}</p>
      <div className="mt-8 grid gap-8">
        {page.sections.map((section) => (
          <section key={section.heading}>
            <h3 className="font-display text-2xl text-paper">{section.heading}</h3>
            {section.body.map((paragraph) => (
              <p key={paragraph.slice(0, 48)} className="mt-3 text-sm leading-7 text-muted">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  )
}
