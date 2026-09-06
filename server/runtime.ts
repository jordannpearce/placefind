export function isSellerMode() {
  return process.env.PLACEFIND_STATIC !== "1" && process.env.NODE_ENV !== "production"
}
