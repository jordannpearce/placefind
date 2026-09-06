import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

export type ProductInfo = {
  name: string
  version: string
  price: string
  pitch: string
}

const STORE = path.resolve(process.cwd(), ".data", "product.json")

const FALLBACK: ProductInfo = {
  name: "PlaceFind",
  version: "1.0.0",
  price: "49",
  pitch: "Windows software that finds a Google Maps listing from a business name, city, and state.",
}

export function readProduct(): ProductInfo {
  try {
    const raw = JSON.parse(readFileSync(STORE, "utf8")) as Partial<ProductInfo>
    return { ...FALLBACK, ...raw }
  } catch {
    return { ...FALLBACK }
  }
}

export function writeProduct(input: Partial<ProductInfo>): ProductInfo {
  const current = readProduct()
  const next: ProductInfo = {
    name: current.name,
    version: current.version,
    price: String(input.price ?? current.price).replace(/[^\d.]/g, "").slice(0, 8) || current.price,
    pitch: (input.pitch ?? current.pitch).trim().slice(0, 240) || current.pitch,
  }
  mkdirSync(path.dirname(STORE), { recursive: true })
  writeFileSync(STORE, JSON.stringify(next, null, 2))
  return next
}
