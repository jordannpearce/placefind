import Link from "next/link"

export function LegalDoc({
  title,
  updated,
  lede,
  children,
}: {
  title: string
  updated: string
  lede: string
  children: React.ReactNode
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        GridPins legal
      </p>
      <h1 className="font-heading mt-2 text-4xl tracking-tight md:text-5xl">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated {updated}</p>
      <p className="mt-6 text-base leading-7 text-muted-foreground">{lede}</p>
      <div className="legal-prose mt-10 space-y-8 text-[15px] leading-7">{children}</div>
      <p className="mt-12 text-sm text-muted-foreground">
        Questions:{" "}
        <a className="text-primary hover:underline" href="mailto:hello@gridpins.com">
          hello@gridpins.com
        </a>{" "}
        or{" "}
        <a className="text-primary hover:underline" href="mailto:hello@info.gridpins.com">
          hello@info.gridpins.com
        </a>
        . Also see{" "}
        <Link href="/terms" className="text-primary hover:underline">
          Terms
        </Link>
        ,{" "}
        <Link href="/privacy" className="text-primary hover:underline">
          Privacy
        </Link>
        ,{" "}
        <Link href="/email-policy" className="text-primary hover:underline">
          Email
        </Link>
        , and{" "}
        <Link href="/refunds" className="text-primary hover:underline">
          Refunds
        </Link>
        .
      </p>
    </article>
  )
}

export function H({ children }: { children: React.ReactNode }) {
  return <h2 className="font-heading text-2xl tracking-tight">{children}</h2>
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="text-foreground/90">{children}</p>
}
