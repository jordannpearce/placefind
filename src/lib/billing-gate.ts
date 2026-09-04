import { NextResponse } from "next/server"
import { redirect } from "next/navigation"

import { requireUser, type Authed } from "@/lib/auth-guard"
import { readDb } from "@/lib/db"
import {
  billingPathForUser,
  billingRequiredPayload,
  findCustomerIdForUser,
  pickAccessSubscription,
  subscriptionsForUser,
  userHasSoftwareAccess,
} from "@/lib/paddle-access"
import type { PaddleSubscription, User } from "@/lib/types"

export type SoftwareAccessState = {
  auth: Authed
  current: boolean
  billingPath: string
  customerId: string
  subscription: PaddleSubscription | null
}

export async function softwareAccessState(): Promise<SoftwareAccessState | null> {
  const auth = await requireUser()
  if (!auth) return null
  const db = await readDb()
  const current = userHasSoftwareAccess(auth.user, db)
  return {
    auth,
    current,
    billingPath: billingPathForUser(auth.user, db),
    customerId: findCustomerIdForUser(auth.user, db.customers),
    subscription: pickAccessSubscription(subscriptionsForUser(auth.user, db)),
  }
}

export async function requireSoftwareAccessOrRedirect(): Promise<Authed> {
  const state = await softwareAccessState()
  if (!state) redirect("/login")
  if (!state.current) redirect(state.billingPath)
  return state.auth
}

export function billingRequiredResponse(user: User, mirror: Parameters<typeof billingRequiredPayload>[1]) {
  return NextResponse.json(billingRequiredPayload(user, mirror), { status: 402 })
}

/** 401 if signed out, 402 if not current, otherwise null (caller continues). */
export async function rejectUnlessSoftwareAccess() {
  const auth = await requireUser()
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const db = await readDb()
  if (userHasSoftwareAccess(auth.user, db)) return null
  return billingRequiredResponse(auth.user, db)
}
