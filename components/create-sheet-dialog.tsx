"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { readApiResponse } from "@/lib/http"
import type { TrackedToken, WorkbookSheet } from "@/lib/types"

interface CreateSheetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tokens: TrackedToken[]
  selectedWalletIds: string[]
  onCreated?: (sheet: WorkbookSheet) => void | Promise<void>
}

export function CreateSheetDialog({
  open,
  onOpenChange,
  tokens,
  selectedWalletIds,
  onCreated,
}: CreateSheetDialogProps) {
  const [name, setName] = useState("")
  const [tokenMint, setTokenMint] = useState<string>("none")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setName("")
      setTokenMint("none")
    }
  }, [open])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const selectedToken = tokens.find((token) => token.mint === tokenMint)
      const result = await readApiResponse<{ sheet: WorkbookSheet }>(
        await fetch("/api/sheets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            token_mint: tokenMint === "none" ? null : tokenMint,
            token_symbol: selectedToken?.symbol || null,
            walletIds: selectedWalletIds,
          }),
        })
      )

      toast.success("Launch sheet created", {
        description:
          selectedWalletIds.length > 0
            ? `${selectedWalletIds.length} wallets copied from the master sheet.`
            : "You can add wallets from the master sheet whenever you're ready.",
      })
      await onCreated?.(result.sheet)
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to create sheet", {
        description:
          error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Launch Sheet</DialogTitle>
            <DialogDescription>
              Create a workbook tab from the master sheet
              {selectedWalletIds.length > 0
                ? ` using ${selectedWalletIds.length} selected wallets.`
                : "."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sheet-name">Sheet name</Label>
              <Input
                id="sheet-name"
                placeholder="$PIXL Launch 1"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sheet-token">Sheet token</Label>
              <Select value={tokenMint} onValueChange={setTokenMint}>
                <SelectTrigger id="sheet-token">
                  <SelectValue placeholder="No token assigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No token assigned</SelectItem>
                  {tokens.map((token) => (
                    <SelectItem key={token.mint} value={token.mint}>
                      {token.symbol} - {token.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Sheet"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
