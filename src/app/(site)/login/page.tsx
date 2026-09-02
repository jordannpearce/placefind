import Link from "next/link"

import { AuthForm } from "@/components/auth-form"

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-heading text-4xl">Log in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Use your GridPins workspace. Demo: <span className="font-medium text-foreground">demo@gridpin.app</span> /{" "}
        <span className="font-medium text-foreground">demo1234</span>
      </p>
      <div className="mt-8 rounded-2xl border bg-card p-6">
        <AuthForm mode="login" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/signup" className="text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}
