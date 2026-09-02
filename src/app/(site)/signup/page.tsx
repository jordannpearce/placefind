import Link from "next/link"

import { AuthForm } from "@/components/auth-form"

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-heading text-4xl">Create a workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We send an activation email through Resend. If no API key is set, GridPin stores the
        message in the local inbox so you can still activate.
      </p>
      <div className="mt-8 rounded-2xl border bg-card p-6">
        <AuthForm mode="signup" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
