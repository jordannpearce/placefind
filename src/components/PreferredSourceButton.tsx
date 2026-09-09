import { useEffect, useRef } from "react"

/** Official Google Preferred Sources button. Script loads once from index.html. */
export function PreferredSourceButton() {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = root.current
    if (!node) return
    node.setAttribute("google-add-preferred-source-btn", "")
    node.setAttribute("data-theme", "dark")
  }, [])

  return <div ref={root} className="preferred-source-btn" data-theme="dark" google-add-preferred-source-btn="" />
}
