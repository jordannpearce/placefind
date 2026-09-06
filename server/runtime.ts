export function isPackagedBuyer() {
  return process.env.PLACEFIND_STATIC === "1"
}

export function isSellerMode() {
  return !isPackagedBuyer() && process.env.NODE_ENV !== "production"
}

export function isStoreEnabled() {
  return !isPackagedBuyer()
}
