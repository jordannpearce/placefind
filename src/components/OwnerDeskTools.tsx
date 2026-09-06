type Props = {
  onGo: (path: string) => void
}

const TOOLS = [
  {
    href: "/track",
    label: "Rank tracker",
    detail: "Scan a rank grid for a confirmed listing.",
    testId: "open-rank-tracker",
  },
  {
    href: "/track#traffic",
    label: "Traffic",
    detail: "Start Traffic after a confirmed Track scan.",
    testId: "open-traffic",
  },
] as const

export function OwnerDeskTools({ onGo }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {TOOLS.map((tool) => (
        <button
          key={tool.href}
          type="button"
          data-testid={tool.testId}
          onClick={() => onGo(tool.href)}
          className="rounded-xl border border-line bg-ink px-4 py-3 text-left hover:border-brass/60"
        >
          <p className="text-sm font-semibold text-paper">{tool.label}</p>
          <p className="mt-1 text-xs leading-5 text-muted">{tool.detail}</p>
        </button>
      ))}
    </div>
  )
}
