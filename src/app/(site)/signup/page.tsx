import Link from "next/link"

import { AuthForm } from "@/components/auth-form"

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-heading text-4xl">Create a workspace</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        We send an activation email through Resend. After you activate, you are signed in and sent
        to pricing — an active plan is required to run grids. If no API key is set, GridPins stores
        the message in the local inbox so you can still activate.
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
      <p className="mt-3 text-xs leading-5 text-muted-foreground">
        By creating an account you agree to the{" "}
        <Link href="/terms" className="underline">
          Terms
        </Link>
        ,{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        ,{" "}
        <Link href="/email-policy" className="underline">
          Email Policy
        </Link>
        , and{" "}
        <Link href="/refunds" className="underline">
          Refund Policy
        </Link>
        .
      </p>
    </div>
  )
}
