import type { Metadata } from "next"
import { Suspense } from "react"

import { ResetPasswordForm } from "@/components/reset-password-form"

export const metadata: Metadata = {
  title: "Reset password — GridPins",
  description: "Set a new GridPins password from a reset link.",
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-16">
          <h1 className="font-heading text-4xl">Reset password</h1>
          <p className="mt-4 text-sm text-muted-foreground">Checking your link…</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  )
}
