"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ApiSettings } from "@/lib/types"

type SettingsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: ApiSettings
  onSave: (settings: ApiSettings) => void
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onSave,
}: SettingsDialogProps) {
  const [login, setLogin] = useState(settings.login)
  const [password, setPassword] = useState(settings.password)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [ok, setOk] = useState<boolean | null>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setLogin(settings.login)
          setPassword(settings.password)
          setMessage(null)
          setOk(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Maps API keys</DialogTitle>
          <DialogDescription>
            Paste your Maps API login and password. Keys save to your GridPins account and are
            used for live Maps search and scans — not sample rankings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="dfs-login">API login</Label>
            <Input
              id="dfs-login"
              value={login}
              autoComplete="username"
              onChange={(event) => setLogin(event.target.value)}
              placeholder="API login"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dfs-password">API password</Label>
            <Input
              id="dfs-password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="API password"
            />
          </div>
          {message ? (
            <p className={ok ? "text-xs text-emerald-700" : "text-xs text-destructive"}>
              {message}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Leave blank to use the mock engine for this account. Other accounts never share
              these keys.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={testing || !login || !password}
              onClick={async () => {
                setTesting(true)
                setMessage(null)
                try {
                  const response = await fetch("/api/status", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ apiLogin: login, apiPassword: password }),
                  })
                  const data = (await response.json()) as { ok?: boolean; message?: string }
                  setOk(Boolean(data.ok))
                  setMessage(data.message || (data.ok ? "Connected." : "Could not verify."))
                } catch {
                  setOk(false)
                  setMessage("Could not verify credentials.")
                } finally {
                  setTesting(false)
                }
              }}
            >
              {testing ? <Loader2 className="animate-spin" /> : null}
              Test connection
            </Button>
            <Button
              type="button"
              onClick={() => {
                onSave({ login: login.trim(), password: password.trim() })
                onOpenChange(false)
              }}
            >
              Save keys
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
