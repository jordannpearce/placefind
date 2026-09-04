import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { readDb } from "@/lib/db"
import { billingPathForUser, userHasSoftwareAccess } from "@/lib/paddle-access"
import { IMPERSONATE_COOKIE, verifySessionToken } from "@/lib/session-token"

const PROTECTED = ["/dashboard", "/track", "/account", "/admin"]
const PRODUCT = ["/dashboard", "/track"]

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const needsAuth = PROTECTED.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  if (!needsAuth) return NextResponse.next()

  const session = verifySessionToken(request.cookies.get("gridpin_session")?.value)
  if (!session) {
    const login = new URL("/login", request.url)
    login.searchParams.set("next", pathname)
    return NextResponse.redirect(login)
  }
  if (pathname.startsWith("/admin") && session.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  const needsBilling = PRODUCT.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  if (needsBilling) {
    try {
      const db = await readDb()
      const asId = request.cookies.get(IMPERSONATE_COOKIE)?.value
      let user = db.users.find((item) => item.id === session.uid)
      if (asId && session.role === "admin") {
        const target = db.users.find((item) => item.id === asId)
        if (target && target.status !== "pending") user = target
      }
      if (user && !userHasSoftwareAccess(user, db)) {
        return NextResponse.redirect(new URL(billingPathForUser(user, db), request.url))
      }
    } catch {
      // Page and API handlers still enforce billing if the mirror cannot be read here.
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/track",
    "/track/:path*",
    "/account",
    "/account/:path*",
    "/admin",
    "/admin/:path*",
  ],
}
