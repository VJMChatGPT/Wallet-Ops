"use client"

import { useEffect, useMemo, useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { readApiResponse } from "@/lib/http"
import type { WorkbookSheetWithWalletCount } from "@/lib/types"

interface AddWalletsToSheetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sheets: WorkbookSheetWithWalletCount[]
  walletIds: string[]
  onAdded?: () => void | Promise<void>
}

export function AddWalletsToSheetDialog({
  open,
  onOpenChange,
  sheets,
  walletIds,
  onAdded,
}: AddWalletsToSheetDialogProps) {
  const launchSheets = useMemo(
    () => sheets.filter((sheet) => sheet.type === "launch"),
    [sheets]
  )
  const [sheetId, setSheetId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setSheetId("")
      return
    }

    if (!sheetId && launchSheets[0]) {
      setSheetId(launchSheets[0].id)
    }
  }, [launchSheets, open, sheetId])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!sheetId) return

    setIsSubmitting(true)
    try {
      const result = await readApiResponse<{ insertedCount: number }>(
        await fetch(`/api/sheets/${sheetId}/wallets`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletIds }),
        })
      )

      toast.success("Wallets added", {
        description: `${result.insertedCount} wallets copied into the selected launch sheet.`,
      })
      await onAdded?.()
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to add wallets", {
        description:
          error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Wallets to Launch Sheet</DialogTitle>
            <DialogDescription>
              Copy {walletIds.length} selected wallets from the master sheet into another tab.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Select value={sheetId} onValueChange={setSheetId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a launch sheet" />
              </SelectTrigger>
              <SelectContent>
                {launchSheets.map((sheet) => (
                  <SelectItem key={sheet.id} value={sheet.id}>
                    {sheet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Button
              type="submit"
              disabled={isSubmitting || !sheetId || walletIds.length === 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add to Sheet"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
