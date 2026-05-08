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
import { readApiResponse } from "@/lib/http"
import type { WorkbookSheetWithWalletCount } from "@/lib/types"

interface RenameSheetDialogProps {
  sheet: WorkbookSheetWithWalletCount | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRenamed?: (sheet: WorkbookSheetWithWalletCount) => void | Promise<void>
}

export function RenameSheetDialog({
  sheet,
  open,
  onOpenChange,
  onRenamed,
}: RenameSheetDialogProps) {
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setName(sheet?.name || "")
  }, [sheet])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!sheet) return

    setIsSubmitting(true)
    try {
      const result = await readApiResponse<{ sheet: WorkbookSheetWithWalletCount }>(
        await fetch(`/api/sheets/${sheet.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        })
      )

      toast.success("Sheet renamed")
      await onRenamed?.(result.sheet)
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to rename sheet", {
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
            <DialogTitle>Rename Sheet</DialogTitle>
            <DialogDescription>
              Update the workbook tab name without changing the saved rows inside it.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label htmlFor="rename-sheet-name">Sheet name</Label>
            <Input
              id="rename-sheet-name"
              className="mt-2"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
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
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
