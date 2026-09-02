import { cn } from "@/lib/utils"

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-wordmark font-[800] tracking-tight whitespace-nowrap", className)}>
      <span className="text-[#001A17]">Grid</span>
      <span className="bg-gradient-to-r from-[#00D85A] to-[#00B95A] bg-clip-text text-transparent">
        Pins
      </span>
    </span>
  )
}
