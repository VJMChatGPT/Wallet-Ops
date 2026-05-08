"use client"

import { useState } from "react"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { readApiResponse } from "@/lib/http"
import type { PortfolioSnapshot } from "@/lib/types"

interface SaveSnapshotDialogProps {
  selectedTokenMint?: string | null
  selectedTokenSymbol?: string | null
  onSaved?: (snapshot: PortfolioSnapshot) => void | Promise<void>
}

export function SaveSnapshotDialog({
  selectedTokenMint,
  selectedTokenSymbol,
  onSaved,
}: SaveSnapshotDialogProps) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSaving(true)

    try {
      const result = await readApiResponse<{
        snapshot: PortfolioSnapshot
        savedWallets: number
      }>(
        await fetch("/api/snapshots", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, selectedTokenMint }),
        })
      )

      toast.success("Snapshot saved", {
        description: `${result.savedWallets} wallets frozen successfully.`,
      })
      await onSaved?.(result.snapshot)
      setOpen(false)
      setName("")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save snapshot"
      setError(message)
      toast.error("Snapshot failed", { description: message })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Camera className="h-4 w-4" />
          Save Snapshot
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Save Launch Snapshot</DialogTitle>
            <DialogDescription>
              Freeze the current wallet operations state
              {selectedTokenSymbol ? ` for ${selectedTokenSymbol}` : ""} so you
              can compare token amounts and supply ownership later.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="snapshot-name">Snapshot Name</Label>
              <Input
                id="snapshot-name"
                placeholder="Before launch, T+1h, Final result..."
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Optional, but handy when you want to compare before and after a
                launch.
              </p>
            </div>

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Snapshot"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
