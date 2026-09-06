import type { ApiKeys, HostedKeyStatus, InstallerStatus, KeyTestResult, ProductInfo, SearchQuery, SearchResponse } from "./types.ts"

export async function searchBusiness(query: SearchQuery, keys: ApiKeys): Promise<SearchResponse> {
  const response = await fetch("/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...query, ...keys }),
  })
  const payload = (await response.json()) as SearchResponse & { error?: string }
  if (!response.ok && !payload.best && !payload.others) {
    throw new Error(payload.error || "Search failed.")
  }
  return payload
}

export async function testKeys(keys: ApiKeys): Promise<KeyTestResult[]> {
  const response = await fetch("/api/test-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(keys),
  })
  const payload = (await response.json()) as { results?: KeyTestResult[]; error?: string }
  if (!response.ok) throw new Error(payload.error || "Could not test keys.")
  return payload.results ?? []
}

export async function loadStore(): Promise<{ product: ProductInfo; installer: InstallerStatus; hosted: HostedKeyStatus }> {
  const response = await fetch("/api/product")
  if (!response.ok) throw new Error("Could not load product info.")
  return (await response.json()) as { product: ProductInfo; installer: InstallerStatus; hosted: HostedKeyStatus }
}

export async function saveHostedKeys(input: {
  scrappeyKey?: string
  dataforseoLogin?: string
  dataforseoPassword?: string
}): Promise<{ hosted: HostedKeyStatus; installer: InstallerStatus }> {
  const response = await fetch("/api/hosted-keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json()) as { hosted?: HostedKeyStatus; installer?: InstallerStatus; error?: string }
  if (!response.ok || !payload.hosted || !payload.installer) {
    throw new Error(payload.error || "Could not save API keys into the installer.")
  }
  return { hosted: payload.hosted, installer: payload.installer }
}

export async function saveProduct(input: Pick<ProductInfo, "price" | "pitch">): Promise<ProductInfo> {
  const response = await fetch("/api/product", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  const payload = (await response.json()) as { product?: ProductInfo; error?: string }
  if (!response.ok || !payload.product) throw new Error(payload.error || "Could not save product info.")
  return payload.product
}

export async function loadInstaller(): Promise<InstallerStatus> {
  const response = await fetch("/api/installer")
  if (!response.ok) throw new Error("Could not load installer status.")
  return (await response.json()) as InstallerStatus
}

export async function startInstallerBuild(): Promise<InstallerStatus> {
  const response = await fetch("/api/installer/build", { method: "POST" })
  if (!response.ok) throw new Error("Could not start the Windows setup build.")
  return (await response.json()) as InstallerStatus
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
