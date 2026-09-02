import type { Metadata } from "next"
import Link from "next/link"

import { ForgotPasswordForm } from "@/components/forgot-password-form"

export const metadata: Metadata = {
  title: "Forgot password — GridPins",
  description: "Request a GridPins password reset link by email.",
}

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-heading text-4xl">Forgot password</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Enter the email on your GridPins account. If it is on file, we will send a reset link.
      </p>
      <div className="mt-8 rounded-2xl border bg-card p-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
