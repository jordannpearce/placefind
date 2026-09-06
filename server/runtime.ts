export type RuntimeRequest = {
  headers?: {
    "user-agent"?: string
    "User-Agent"?: string
  }
}

export function isPackagedBuyer() {
  return process.env.PLACEFIND_STATIC === "1"
}

export function isDesktopProcess() {
  return isPackagedBuyer() || process.env.PLACEFIND_DESKTOP === "1"
}

export function isElectronUserAgent(userAgent?: string | string[]) {
  const value = Array.isArray(userAgent) ? userAgent.join(" ") : (userAgent ?? "")
  return /Electron/i.test(value)
}

export function requestUserAgent(req?: RuntimeRequest) {
  return req?.headers?.["user-agent"] || req?.headers?.["User-Agent"] || ""
}

export function isDesktopRequest(req?: RuntimeRequest) {
  if (isDesktopProcess()) return true
  return isElectronUserAgent(requestUserAgent(req))
}

export function isSellerMode() {
  return !isPackagedBuyer() && process.env.NODE_ENV !== "production"
}

export function isStoreEnabled() {
  return !isPackagedBuyer()
}
