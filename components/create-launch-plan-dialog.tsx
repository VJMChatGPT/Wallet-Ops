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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { readApiResponse } from "@/lib/http"
import type {
  LaunchPlannerDetail,
  LaunchSelectionMode,
  TrackedToken,
  WorkbookSheetWithWalletCount,
} from "@/lib/types"

interface CreateLaunchPlanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sheets: WorkbookSheetWithWalletCount[]
  tokens: TrackedToken[]
  onCreated?: (detail: LaunchPlannerDetail) => void | Promise<void>
}

const selectionModes: Array<{ value: LaunchSelectionMode; label: string }> = [
  { value: "manual", label: "Manual" },
  { value: "automatic_rotation", label: "Automatic rotation" },
  { value: "least_recently_used", label: "Least recently used" },
  { value: "weighted_random", label: "Weighted random" },
]

export function CreateLaunchPlanDialog({
  open,
  onOpenChange,
  sheets,
  tokens,
  onCreated,
}: CreateLaunchPlanDialogProps) {
  const launchSheets = useMemo(
    () => sheets.filter((sheet) => sheet.type === "launch"),
    [sheets]
  )

  const [name, setName] = useState("")
  const [selectionMode, setSelectionMode] =
    useState<LaunchSelectionMode>("automatic_rotation")
  const [desiredWalletCount, setDesiredWalletCount] = useState("10")
  const [previousSheetId, setPreviousSheetId] = useState<string>("auto")
  const [tokenMint, setTokenMint] = useState<string>("none")
  const [excludePreviousLaunch, setExcludePreviousLaunch] = useState(true)
  const [preferLowerHistoricalUsage, setPreferLowerHistoricalUsage] = useState(true)
  const [randomnessFactor, setRandomnessFactor] = useState("0.15")
  const [targetTotalSol, setTargetTotalSol] = useState("25")
  const [reserveFloor, setReserveFloor] = useState("0.25")
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setName("")
      setSelectionMode("automatic_rotation")
      setDesiredWalletCount("10")
      setPreviousSheetId("auto")
      setTokenMint("none")
      setExcludePreviousLaunch(true)
      setPreferLowerHistoricalUsage(true)
      setRandomnessFactor("0.15")
      setTargetTotalSol("25")
      setReserveFloor("0.25")
    }
  }, [open])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)

    try {
      const detail = await readApiResponse<LaunchPlannerDetail>(
        await fetch("/api/launch-plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            selection_mode: selectionMode,
            desired_wallet_count: Number(desiredWalletCount),
            previous_sheet_id: previousSheetId === "auto" ? null : previousSheetId,
            token_mint: tokenMint === "none" ? null : tokenMint,
            exclude_previous_launch: excludePreviousLaunch,
            prefer_lower_historical_usage: preferLowerHistoricalUsage,
            randomness_factor: Number(randomnessFactor),
            target_total_sol: Number(targetTotalSol),
            reserve_floor: Number(reserveFloor),
          }),
        })
      )

      toast.success("Launch planner created", {
        description: "You can now refine the wallet selection and funding plan.",
      })
      await onCreated?.(detail)
      onOpenChange(false)
    } catch (error) {
      toast.error("Failed to create launch planner", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New Launch Preparation Plan</DialogTitle>
            <DialogDescription>
              Build the next wallet rotation from the full pool, then generate an auditable SOL
              equalization plan.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="plan-name">Plan name</Label>
              <Input
                id="plan-name"
                placeholder="$PIXL Next Launch"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="selection-mode">Selection mode</Label>
              <Select value={selectionMode} onValueChange={(value) => setSelectionMode(value as LaunchSelectionMode)}>
                <SelectTrigger id="selection-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectionModes.map((mode) => (
                    <SelectItem key={mode.value} value={mode.value}>
                      {mode.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="wallet-count">Desired wallet count</Label>
              <Input
                id="wallet-count"
                type="number"
                min={1}
                value={desiredWalletCount}
                onChange={(event) => setDesiredWalletCount(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="previous-sheet">Previous launch sheet</Label>
              <Select value={previousSheetId} onValueChange={setPreviousSheetId}>
                <SelectTrigger id="previous-sheet">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Most recent launch sheet</SelectItem>
                  {launchSheets.map((sheet) => (
                    <SelectItem key={sheet.id} value={sheet.id}>
                      {sheet.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan-token">Token context</Label>
              <Select value={tokenMint} onValueChange={setTokenMint}>
                <SelectTrigger id="plan-token">
                  <SelectValue />
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

            <div className="space-y-2">
              <Label htmlFor="target-average">Total Target SOL</Label>
              <Input
                id="target-average"
                type="number"
                min={0}
                step="0.01"
                value={targetTotalSol}
                onChange={(event) => setTargetTotalSol(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reserve-floor">Reserve floor on source wallets</Label>
              <Input
                id="reserve-floor"
                type="number"
                min={0}
                step="0.01"
                value={reserveFloor}
                onChange={(event) => setReserveFloor(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="randomness-factor">Randomness factor</Label>
              <Input
                id="randomness-factor"
                type="number"
                min={0}
                max={1}
                step="0.05"
                value={randomnessFactor}
                onChange={(event) => setRandomnessFactor(event.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/20 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Exclude previous launch wallets</p>
                <p className="text-xs text-muted-foreground">
                  Prefer fresh wallets when the eligible pool allows it.
                </p>
              </div>
              <Switch
                checked={excludePreviousLaunch}
                onCheckedChange={setExcludePreviousLaunch}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/20 px-3 py-2">
              <div>
                <p className="text-sm font-medium">Prefer lower historical usage</p>
                <p className="text-xs text-muted-foreground">
                  Bias selection toward wallets used less often.
                </p>
              </div>
              <Switch
                checked={preferLowerHistoricalUsage}
                onCheckedChange={setPreferLowerHistoricalUsage}
              />
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
                "Create planner"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
