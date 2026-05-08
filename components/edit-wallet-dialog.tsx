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
import { validateSolanaWalletAddress } from "@/lib/solana"
import type { TrackedWallet } from "@/lib/types"
import { Pencil } from "lucide-react"

interface EditWalletDialogProps {
  wallet: TrackedWallet
  existingAddresses?: string[]
  onSave: (wallet: { id: string; address: string; label: string }) => Promise<void>
}

export function EditWalletDialog({
  wallet,
  existingAddresses = [],
  onSave,
}: EditWalletDialogProps) {
  const [open, setOpen] = useState(false)
  const [address, setAddress] = useState(wallet.address)
  const [label, setLabel] = useState(wallet.label || "")
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const resetState = () => {
    setAddress(wallet.address)
    setLabel(wallet.label || "")
    setError("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const validation = validateSolanaWalletAddress(address)
    if (!validation.isValid || !validation.normalizedAddress) {
      setError(validation.error || "Invalid Solana wallet address")
      return
    }

    if (
      existingAddresses.includes(validation.normalizedAddress) &&
      validation.normalizedAddress !== wallet.address
    ) {
      setError("Wallet already exists")
      return
    }

    setIsSubmitting(true)
    try {
      await onSave({
        id: wallet.id,
        address: validation.normalizedAddress,
        label: label.trim(),
      })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update wallet")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (!nextOpen) {
          resetState()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Wallet</DialogTitle>
            <DialogDescription>
              Update the wallet name or address.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor={`edit-address-${wallet.id}`}>Wallet Address</Label>
              <Input
                id={`edit-address-${wallet.id}`}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-label-${wallet.id}`}>Name</Label>
              <Input
                id={`edit-label-${wallet.id}`}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Optional wallet name"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
