"use client"

import { useMemo, useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { validateSolanaWalletAddress } from "@/lib/solana"
import { AlertCircle, CheckCircle2, Plus, Trash2, Upload } from "lucide-react"

type WalletType = "mine" | "external"

interface BulkWalletEntry {
  id: string
  lineNumber: number
  originalLine: string
  address: string
  label: string
  normalizedAddress: string | null
  isEmpty: boolean
  error: string | null
}

interface AddWalletDialogProps {
  existingAddresses?: string[]
  onAdd: (wallet: {
    address: string
    label: string
    type: WalletType
  }) => Promise<void>
  onAddBulk: (wallets: {
    address: string
    label: string
    type: WalletType
    lineNumber: number
  }[]) => Promise<{
    insertedCount: number
    failures?: { address: string; lineNumber: number | null; error: string }[]
  }>
}

export function AddWalletDialog({
  existingAddresses = [],
  onAdd,
  onAddBulk,
}: AddWalletDialogProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"single" | "bulk">("single")
  const [address, setAddress] = useState("")
  const [label, setLabel] = useState("")
  const [type, setType] = useState<WalletType>("mine")
  const [bulkInput, setBulkInput] = useState("")
  const [bulkLabels, setBulkLabels] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [bulkServerFailures, setBulkServerFailures] = useState<
    { address: string; lineNumber: number | null; error: string }[]
  >([])

  const existingAddressSet = useMemo(
    () => new Set(existingAddresses),
    [existingAddresses]
  )

  const bulkEntries = useMemo<BulkWalletEntry[]>(() => {
    const lines = bulkInput.split(/\r?\n/)
    const firstSeenLineByAddress = new Map<string, number>()

    return lines.map((line, index) => {
      const [rawAddress, ...labelParts] = line.split(",")
      const trimmed = rawAddress.trim()
      const parsedLabel = labelParts.join(",").trim()
      const id = `${index}-${line}`
      const label = bulkLabels[id] ?? parsedLabel

      if (!trimmed) {
        return {
          id,
          lineNumber: index + 1,
          originalLine: line,
          address: "",
          label,
          normalizedAddress: null,
          isEmpty: true,
          error: null,
        }
      }

      const validation = validateSolanaWalletAddress(trimmed)
      let detectedError: string | null = null
      let normalizedAddress: string | null = null

      if (!validation.isValid || !validation.normalizedAddress) {
        detectedError = validation.error || "Invalid Solana wallet address"
      } else {
        normalizedAddress = validation.normalizedAddress

        if (existingAddressSet.has(normalizedAddress)) {
          detectedError = "Wallet already exists"
        } else if (firstSeenLineByAddress.has(normalizedAddress)) {
          detectedError = `Duplicate of line ${firstSeenLineByAddress.get(
            normalizedAddress
          )}`
        } else {
          firstSeenLineByAddress.set(normalizedAddress, index + 1)
        }
      }

      return {
        id,
        lineNumber: index + 1,
        originalLine: line,
        address: trimmed,
        label,
        normalizedAddress,
        isEmpty: false,
        error: detectedError,
      }
    })
  }, [bulkInput, bulkLabels, existingAddressSet])

  const visibleBulkEntries = bulkEntries.filter((entry) => !entry.isEmpty)
  const validBulkEntries = visibleBulkEntries.filter(
    (entry) => !entry.error && entry.normalizedAddress
  )
  const invalidBulkEntries = visibleBulkEntries.filter((entry) => entry.error)

  const resetState = () => {
    setAddress("")
    setLabel("")
    setType("mine")
    setBulkInput("")
    setBulkLabels({})
    setError("")
    setBulkServerFailures([])
    setMode("single")
  }

  const removeBulkLine = (lineNumber: number) => {
    const nextLines = bulkInput.split(/\r?\n/)
    const removedLine = nextLines[lineNumber - 1]
    nextLines.splice(lineNumber - 1, 1)
    setBulkInput(nextLines.join("\n"))
    setBulkLabels((current) => {
      const next = { ...current }
      delete next[`${lineNumber - 1}-${removedLine}`]
      return next
    })
    setBulkServerFailures((current) =>
      current.filter((failure) => failure.lineNumber !== lineNumber)
    )
  }

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const validation = validateSolanaWalletAddress(address)
    if (!validation.isValid || !validation.normalizedAddress) {
      setError(validation.error || "Invalid Solana wallet address")
      return
    }

    if (existingAddressSet.has(validation.normalizedAddress)) {
      setError("Wallet already exists")
      return
    }

    setIsSubmitting(true)
    try {
      await onAdd({
        address: validation.normalizedAddress,
        label: label.trim(),
        type,
      })
      setOpen(false)
      resetState()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add wallet")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBulkSubmit = async () => {
    setError("")
    setBulkServerFailures([])

    if (validBulkEntries.length === 0) {
      setError("Add at least one valid Solana wallet")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await onAddBulk(
        validBulkEntries.map((entry) => ({
          address: entry.normalizedAddress!,
          label: entry.label.trim(),
          type,
          lineNumber: entry.lineNumber,
        }))
      )

      if (result.failures?.length) {
        setBulkServerFailures(result.failures)
      }

      const failedLineNumbers = new Set(
        (result.failures || [])
          .map((failure) => failure.lineNumber)
          .filter((lineNumber): lineNumber is number => lineNumber !== null)
      )

      const remainingLines = bulkInput
        .split(/\r?\n/)
        .filter((_, index) => failedLineNumbers.has(index + 1))

      if (result.insertedCount > 0) {
        setBulkInput(remainingLines.join("\n"))
      }

      if (remainingLines.length === 0 && (!result.failures || result.failures.length === 0)) {
        setOpen(false)
        resetState()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add wallets")
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
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Add Wallet
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add Wallets</DialogTitle>
          <DialogDescription>
            Add a single Solana wallet or paste multiple wallets in bulk.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "single" ? "default" : "outline"}
            onClick={() => {
              setMode("single")
              setError("")
            }}
          >
            Single
          </Button>
          <Button
            type="button"
            variant={mode === "bulk" ? "default" : "outline"}
            onClick={() => {
              setMode("bulk")
              setError("")
            }}
          >
            Bulk
          </Button>
        </div>

        {mode === "single" ? (
          <form onSubmit={handleSingleSubmit}>
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
                <Select value={type} onValueChange={(v) => setType(v as WalletType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mine">My Wallet</SelectItem>
                    <SelectItem value="external">External Wallet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
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
        ) : (
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="bulk-wallets">Wallets</Label>
              <Textarea
                id="bulk-wallets"
                placeholder={`Paste one Solana wallet per line\n6dPn8PveuYuWgHCWwzvjTVLJm4CUX7c9oezHG3PDNstc\n4eArCRfx31dBaT8XkpGJoandb5BpFFYjQuZ278rWLvvp`}
                value={bulkInput}
                onChange={(e) => {
                  setBulkInput(e.target.value)
                  setBulkServerFailures([])
                }}
                className="min-h-40 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                One wallet per line. You can also paste `address,label`. Duplicates,
                empty lines, other chains and invalid addresses are flagged before
                import.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bulk-type">Wallet Type</Label>
                <Select value={type} onValueChange={(v) => setType(v as WalletType)}>
                  <SelectTrigger id="bulk-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mine">My Wallets</SelectItem>
                    <SelectItem value="external">External Wallets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Badge variant="secondary">
                  {validBulkEntries.length} valid
                </Badge>
                <Badge variant={invalidBulkEntries.length > 0 ? "destructive" : "secondary"}>
                  {invalidBulkEntries.length} invalid
                </Badge>
              </div>
            </div>

            {visibleBulkEntries.length > 0 && (
              <div className="rounded-lg border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-medium">Review pasted wallets</p>
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto p-3">
                  {visibleBulkEntries.map((entry) => {
                    const serverFailure = bulkServerFailures.find(
                      (failure) => failure.lineNumber === entry.lineNumber
                    )
                    const failureText = serverFailure?.error || entry.error

                    return (
                      <div
                        key={entry.id}
                        className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${
                          failureText
                            ? "border-destructive/50 bg-destructive/5"
                            : "border-border"
                        }`}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Line {entry.lineNumber}</Badge>
                            {failureText ? (
                              <span className="inline-flex items-center gap-1 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4" />
                                {failureText}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-sm text-primary">
                                <CheckCircle2 className="h-4 w-4" />
                                Ready
                              </span>
                            )}
                          </div>
                          <p className="break-all font-mono text-sm">{entry.address}</p>
                          <div className="pt-1">
                            <Input
                              value={entry.label}
                              onChange={(e) =>
                                setBulkLabels((current) => ({
                                  ...current,
                                  [entry.id]: e.target.value,
                                }))
                              }
                              placeholder="Optional wallet name"
                              className="h-8"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => removeBulkLine(entry.lineNumber)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleBulkSubmit}
                disabled={isSubmitting || validBulkEntries.length === 0}
                className="gap-2"
              >
                <Upload className="h-4 w-4" />
                {isSubmitting
                  ? "Adding..."
                  : `Add valid wallets (${validBulkEntries.length})`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
