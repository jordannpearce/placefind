import { useEffect, useRef } from "react"

export const PREFERRED_SOURCE_DEEPLINK = "https://www.google.com/preferences/source?q=placefind.to"

/** Official Google Preferred Sources button. Script loads once from index.html. */
export function PreferredSourceButton() {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = root.current
    if (!node) return
    node.setAttribute("google-add-preferred-source-btn", "")
    node.setAttribute("data-theme", "dark")
  }, [])

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div ref={root} className="preferred-source-btn" data-theme="dark" google-add-preferred-source-btn="" />
      <a
        href={PREFERRED_SOURCE_DEEPLINK}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-brass underline decoration-brass/50 hover:text-paper"
      >
        Add as preferred source
      </a>
    </div>
  )
}
