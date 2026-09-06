const VENDOR_TALK =
  /dataforseo|scrappey|keygen|resend|api keys?|api password|hosted keys?|seller keys?|\btokens?\b/i

export function leaksVendorTalk(text: string): boolean {
  return VENDOR_TALK.test(text)
}

export function publicSearchMessage(text: string | undefined): string | undefined {
  if (!text) return text
  if (!VENDOR_TALK.test(text) && !/add your|in settings/i.test(text)) return text
  const lower = text.toLowerCase()
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "Maps search timed out. Try again in a moment."
  }
  if (lower.includes("sample") || lower.includes("no api") || lower.includes("add your")) {
    return "This is a sample listing so you can see how PlaceFind presents a match."
  }
  return "Maps search could not finish. Try again in a moment."
}

export function publicCheckoutWarning(internalError?: string): string | undefined {
  if (!internalError) return undefined
  return "Your payment is in. Your license key will appear on your account page and in email once it is issued."
}

export function mapsKeysMissingPublicMessage() {
  return "Maps search is not configured, so a rank scan cannot run."
}

export function mapsKeysMissingAdminMessage() {
  return "Maps rank tracking is not configured. Save Maps search credentials on Admin, or set the Railway Maps variables, before a Track scan can run."
}

export function publicPinScanMessage(text: string | undefined): string {
  if (!text) return "Maps search could not finish this point."
  const lower = text.toLowerCase()
  if (/no search results/.test(lower)) return "No results at this point."
  if (/timeout|timed out/.test(lower)) return "Maps search timed out."
  if (/could not reach|network|econnreset|enotfound|fetch failed|aborted/.test(lower)) return "Could not reach Maps."
  if (VENDOR_TALK.test(text) || /add your|in settings|api password|http \d+/.test(lower)) {
    return "Maps search could not finish this point."
  }
  return text
}

export function publicTrafficMessage(text: string | undefined): string {
  if (!text) return "Traffic runner could not finish. Try again in a moment."
  if (text === "Traffic runner is not configured.") return text
  const stripped = text
    .replace(/[?&](?:key|token|password|login)=[^&\s]+/gi, "")
    .split("\n")[0]!
    .trim()
  if (/\bat\s+\S+\s+\(/.test(text) || /stack trace/i.test(text)) {
    return "Traffic runner could not finish. Try again in a moment."
  }
  if (!VENDOR_TALK.test(stripped) && !/add your|in settings/i.test(stripped)) return stripped
  if (/timeout|timed out/i.test(stripped)) return "Traffic runner timed out. Try again in a moment."
  if (/not configured|missing/i.test(stripped)) return "Traffic runner is not configured."
  return "Traffic runner could not finish. Try again in a moment."
}
