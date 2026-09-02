import { Suspense } from "react"

import { VerifyClient } from "@/components/verify-client"

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-16">
          <h1 className="font-heading text-4xl">Activate account</h1>
          <p className="mt-4 text-sm text-muted-foreground">Checking your link…</p>
        </div>
      }
    >
      <VerifyClient />
    </Suspense>
  )
}
