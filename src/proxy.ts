import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { verifySessionToken } from "@/lib/session-token"

const PROTECTED = ["/dashboard", "/track", "/account", "/admin"]

export function proxy(request: NextRequest) {
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
