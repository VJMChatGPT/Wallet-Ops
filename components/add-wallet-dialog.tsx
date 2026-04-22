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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus } from "lucide-react"

interface AddWalletDialogProps {
  onAdd: (wallet: { address: string; label: string; type: "mine" | "external" }) => Promise<void>
}

export function AddWalletDialog({ onAdd }: AddWalletDialogProps) {
  const [open, setOpen] = useState(false)
  const [address, setAddress] = useState("")
  const [label, setLabel] = useState("")
  const [type, setType] = useState<"mine" | "external">("mine")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!address.trim()) {
      setError("Wallet address is required")
      return
    }

    // Basic Solana address validation
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    if (!solanaAddressRegex.test(address.trim())) {
      setError("Invalid Solana wallet address")
      return
    }

    setIsSubmitting(true)
    try {
      await onAdd({ address: address.trim(), label: label.trim(), type })
      setOpen(false)
      setAddress("")
      setLabel("")
      setType("mine")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add wallet")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Wallet</DialogTitle>
            <DialogDescription>
              Track a Solana wallet to monitor its token holdings.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="address">Wallet Address</Label>
              <Input
                id="address"
                placeholder="Enter Solana wallet address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Label (optional)</Label>
              <Input
                id="label"
                placeholder="e.g., Main Trading Wallet"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Wallet Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "mine" | "external")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mine">My Wallet</SelectItem>
                  <SelectItem value="external">External Wallet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Wallet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
