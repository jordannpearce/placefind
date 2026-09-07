import { ExternalLink } from "lucide-react"
import {
  GOOGLE_BUSINESS_PROFILE_LINK_LABEL,
  GOOGLE_BUSINESS_PROFILE_SIGNIN_NOTE,
  GOOGLE_BUSINESS_PROFILE_URL,
  mapsNotFoundCtaCopy,
} from "../lib/listings.ts"

type Props = {
  intro?: string
}

export function GoogleBusinessProfileCta({ intro = mapsNotFoundCtaCopy() }: Props) {
  return (
    <div className="mt-4 rounded-xl border border-brass/40 bg-brass/10 px-4 py-4">
      <p className="text-sm leading-6 text-paper">{intro}</p>
      <a
        href={GOOGLE_BUSINESS_PROFILE_URL}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brass hover:underline"
      >
        <ExternalLink className="h-4 w-4 shrink-0" />
        {GOOGLE_BUSINESS_PROFILE_LINK_LABEL}
      </a>
      <p className="mt-2 text-xs leading-5 text-muted">{GOOGLE_BUSINESS_PROFILE_SIGNIN_NOTE}</p>
    </div>
  )
}
