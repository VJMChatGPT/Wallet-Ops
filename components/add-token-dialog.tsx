"use client"

import { useState } from "react"
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
import { Plus, Loader2 } from "lucide-react"

interface AddTokenDialogProps {
  onAdd: (mint: string) => Promise<void>
  trigger?: React.ReactNode
}

export function AddTokenDialog({ onAdd, trigger }: AddTokenDialogProps) {
  const [open, setOpen] = useState(false)
  const [mint, setMint] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!mint.trim()) {
      setError("Token mint address is required")
      return
    }

    // Solana address validation (Base58, 32-44 characters)
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    if (!solanaAddressRegex.test(mint.trim())) {
      setError("Invalid Solana mint address. Must be a valid Base58 address (32-44 characters).")
      return
    }

    setIsSubmitting(true)
    try {
      await onAdd(mint.trim())
      setOpen(false)
      setMint("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add token")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Add Token
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Track New Token</DialogTitle>
            <DialogDescription>
              Enter a Solana token mint address to start tracking it across your wallets.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mint">Token Mint Address</Label>
              <Input
                id="mint"
                placeholder="e.g., EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
                value={mint}
                onChange={(e) => setMint(e.target.value)}
                className="font-mono text-sm"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Paste the contract/mint address of any Solana SPL token
              </p>
            </div>
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Token"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
