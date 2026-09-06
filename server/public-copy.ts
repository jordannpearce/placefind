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
