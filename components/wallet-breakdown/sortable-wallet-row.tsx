"use client"

import { memo, useCallback, useEffect, useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { MoreHorizontal, RotateCcw, ArrowUp, ArrowDown, X, GripVertical } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TableCell, TableRow } from "@/components/ui/table"
import { SolscanLink } from "@/components/solscan-link"
import { formatNumber } from "@/lib/api"
import {
  formatFundedAtInputValue,
  FUNDING_SOURCE_OPTIONS,
  getWalletFieldBadgeClass,
  PLATFORM_OPTIONS,
  TRADE_STATUS_OPTIONS,
} from "@/lib/wallet-fields"
import { cn } from "@/lib/utils"
import type { WalletHoldingSummary } from "@/lib/types"
import { DragHandleCell } from "./drag-handle-cell"

type WalletPatch = {
  label?: string | null
  trade_status?: string | null
  funding_source_label?: string | null
  platform?: string | null
  funded_at?: string | null
  planned_for_launch?: boolean
  used_in_launch?: boolean
  used_notes?: string | null
  sort_order?: number | null
}

interface SortableWalletRowProps {
  wallet: WalletHoldingSummary
  selectedToken: string | null
  selectable?: boolean
  selected?: boolean
  onToggleWallet?: (walletId: string, checked: boolean) => void
  onUpdateWallet?: (walletId: string, patch: WalletPatch) => Promise<void>
  onMoveWallet?: (walletId: string, direction: "up" | "down") => Promise<void>
  onRemoveWallet?: (walletId: string) => Promise<void>
  onRefreshFunding?: (walletId: string) => Promise<void>
  canMoveUp?: boolean
  canMoveDown?: boolean
  dropIndicator?: "before" | "after" | null
}

function shortAddress(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-8)}`
}

function formatSol(value: number | null) {
  if (value === null || value === undefined) return "-"

  return formatNumber(value, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  })
}

function formatUsdc(value: number) {
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatSupplyPercent(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(4)}%` : "-"
}

export const SortableWalletRow = memo(function SortableWalletRow({
  wallet,
  selectedToken,
  selectable,
  selected,
  onToggleWallet,
  onUpdateWallet,
  onMoveWallet,
  onRemoveWallet,
  onRefreshFunding,
  canMoveUp,
  canMoveDown,
  dropIndicator,
}: SortableWalletRowProps) {
  const sortableId = wallet.walletId || wallet.walletAddress
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId,
    disabled: !wallet.walletId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-border bg-card",
        isDragging && "z-10 opacity-45 shadow-lg",
        dropIndicator === "before" && "border-t-2 border-t-primary",
        dropIndicator === "after" && "border-b-2 border-b-primary"
      )}
    >
      {selectable && (
        <TableCell>
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => {
              if (wallet.walletId && onToggleWallet) {
                onToggleWallet(wallet.walletId, Boolean(checked))
              }
            }}
          />
        </TableCell>
      )}
      <TableCell className="w-[52px]">
        <DragHandleCell
          attributes={attributes}
          listeners={listeners}
          setActivatorNodeRef={setActivatorNodeRef}
          isDragging={isDragging}
        />
      </TableCell>
      <TableCell className="font-medium">
        <WalletLabelInput
          walletId={wallet.walletId}
          value={wallet.walletLabel}
          onSave={onUpdateWallet}
        />
      </TableCell>
      <TableCell>
        <code className="text-xs text-muted-foreground">
          <SolscanLink
            address={wallet.walletAddress}
            label={shortAddress(wallet.walletAddress)}
          />
        </code>
      </TableCell>
      <TableCell>
        <WalletFieldSelect
          value={wallet.tradeStatus}
          options={TRADE_STATUS_OPTIONS}
          placeholder="---"
          onChange={(value) =>
            wallet.walletId && onUpdateWallet
              ? onUpdateWallet(wallet.walletId, { trade_status: value })
              : Promise.resolve()
          }
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <WalletFieldSelect
            value={wallet.fundingSourceLabel}
            options={FUNDING_SOURCE_OPTIONS}
            placeholder="---"
            onChange={(value) =>
              wallet.walletId && onUpdateWallet
                ? onUpdateWallet(wallet.walletId, {
                    funding_source_label: value,
                  })
                : Promise.resolve()
            }
          />
          {wallet.walletId && onRefreshFunding && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground"
              onClick={() => void onRefreshFunding(wallet.walletId!)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </TableCell>
      <TableCell>
        <WalletFieldSelect
          value={wallet.platform}
          options={PLATFORM_OPTIONS}
          placeholder="---"
          onChange={(value) =>
            wallet.walletId && onUpdateWallet
              ? onUpdateWallet(wallet.walletId, { platform: value })
              : Promise.resolve()
          }
        />
      </TableCell>
      <TableCell>
        <WalletDateInput
          walletId={wallet.walletId}
          value={wallet.fundedAt}
          onSave={onUpdateWallet}
        />
      </TableCell>
      <TableCell className="text-center">
        <WalletFlagCheckbox
          checked={wallet.plannedForLaunch}
          label="Planned for launch"
          onCheckedChange={(checked) =>
            wallet.walletId && onUpdateWallet
              ? onUpdateWallet(wallet.walletId, { planned_for_launch: checked })
              : Promise.resolve()
          }
        />
      </TableCell>
      <TableCell className="text-center">
        <WalletFlagCheckbox
          checked={wallet.usedInLaunch}
          label="Used in launch"
          onCheckedChange={(checked) =>
            wallet.walletId && onUpdateWallet
              ? onUpdateWallet(wallet.walletId, { used_in_launch: checked })
              : Promise.resolve()
          }
        />
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatSol(wallet.solBalance)}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatUsdc(wallet.usdcBalance)}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatUsdc(wallet.jlUsdcBalance)}
      </TableCell>
      <TableCell className="text-right font-mono font-medium">
        {selectedToken ? wallet.selectedTokenBalanceFormatted || "0" : "-"}
      </TableCell>
      <TableCell className="text-right font-mono font-semibold text-primary">
        {selectedToken ? formatSupplyPercent(wallet.selectedTokenSupplyPercent) : "-"}
      </TableCell>
      {(onMoveWallet || onRemoveWallet) && (
        <TableCell className="w-[56px] text-right">
          <RowActionsMenu
            wallet={wallet}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onMoveWallet={onMoveWallet}
            onRemoveWallet={onRemoveWallet}
          />
        </TableCell>
      )}
    </TableRow>
  )
})

function WalletLabelInput({
  walletId,
  value,
  onSave,
}: {
  walletId: string | null
  value: string | null
  onSave?: (walletId: string, patch: WalletPatch) => Promise<void>
}) {
  const [draft, setDraft] = useState(value || "")

  useEffect(() => {
    setDraft(value || "")
  }, [value])

  const commit = useCallback(async () => {
    if (!walletId || !onSave) {
      return
    }

    const normalizedCurrent = (value || "").trim()
    const normalizedDraft = draft.trim()

    if (normalizedCurrent === normalizedDraft) {
      return
    }

    await onSave(walletId, {
      label: normalizedDraft || null,
    })
  }, [draft, onSave, value, walletId])

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        void commit()
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          void commit()
          event.currentTarget.blur()
        }
      }}
      placeholder="Unnamed Wallet"
      className="h-8 min-w-[160px] border-border bg-transparent text-sm font-medium"
    />
  )
}

function WalletFieldSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string | null
  options: readonly string[]
  placeholder: string
  onChange: (value: string | null) => Promise<void>
}) {
  return (
    <Select
      value={value || "__empty__"}
      onValueChange={(nextValue) => {
        void onChange(nextValue === "__empty__" ? null : nextValue)
      }}
    >
      <SelectTrigger
        className={cn(
          "h-8 min-w-[110px] border px-2 text-xs",
          getWalletFieldBadgeClass(value)
        )}
      >
        <SelectValue placeholder={placeholder}>
          <span className="truncate">{value || placeholder}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__empty__">---</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function WalletDateInput({
  walletId,
  value,
  onSave,
}: {
  walletId: string | null
  value: string | null
  onSave?: (walletId: string, patch: WalletPatch) => Promise<void>
}) {
  const [draft, setDraft] = useState(formatFundedAtInputValue(value))

  useEffect(() => {
    setDraft(formatFundedAtInputValue(value))
  }, [value])

  const commit = useCallback(async () => {
    if (!walletId || !onSave) {
      return
    }

    const normalizedCurrent = formatFundedAtInputValue(value)
    if (normalizedCurrent === draft) {
      return
    }

    await onSave(walletId, {
      funded_at: draft || null,
    })
  }, [draft, onSave, value, walletId])

  return (
    <Input
      type="datetime-local"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        void commit()
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          void commit()
          event.currentTarget.blur()
        }
      }}
      className="h-8 min-w-[168px] border-border bg-transparent text-xs"
    />
  )
}

function WalletFlagCheckbox({
  checked,
  label,
  onCheckedChange,
}: {
  checked: boolean
  label: string
  onCheckedChange: (checked: boolean) => Promise<void>
}) {
  return (
    <div className="flex justify-center">
      <Checkbox
        checked={checked}
        aria-label={label}
        onCheckedChange={(value) => {
          void onCheckedChange(Boolean(value))
        }}
      />
    </div>
  )
}

function RowActionsMenu({
  wallet,
  canMoveUp,
  canMoveDown,
  onMoveWallet,
  onRemoveWallet,
}: {
  wallet: WalletHoldingSummary
  canMoveUp?: boolean
  canMoveDown?: boolean
  onMoveWallet?: (walletId: string, direction: "up" | "down") => Promise<void>
  onRemoveWallet?: (walletId: string) => Promise<void>
}) {
  const walletId = wallet.walletId

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={!walletId || !canMoveUp || !onMoveWallet}
          onClick={() => {
            if (walletId && onMoveWallet) {
              void onMoveWallet(walletId, "up")
            }
          }}
        >
          <ArrowUp className="mr-2 h-4 w-4" />
          Move up
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!walletId || !canMoveDown || !onMoveWallet}
          onClick={() => {
            if (walletId && onMoveWallet) {
              void onMoveWallet(walletId, "down")
            }
          }}
        >
          <ArrowDown className="mr-2 h-4 w-4" />
          Move down
        </DropdownMenuItem>
        {onRemoveWallet && walletId && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => void onRemoveWallet(walletId)}
            >
              <X className="mr-2 h-4 w-4" />
              Remove from sheet
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface WalletRowOverlayProps {
  wallet: WalletHoldingSummary
  selectedToken: string | null
  selectedTokenSymbol?: string
}

export function WalletRowOverlay({
  wallet,
  selectedToken,
  selectedTokenSymbol,
}: WalletRowOverlayProps) {
  return (
    <div className="flex min-w-[720px] items-center gap-4 rounded-md border border-primary/40 bg-card px-4 py-3 shadow-2xl">
      <div className="w-[32px] text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="min-w-[160px] font-medium">{wallet.walletLabel || "Unnamed Wallet"}</div>
      <div className="min-w-[150px] font-mono text-xs text-muted-foreground">
        {shortAddress(wallet.walletAddress)}
      </div>
      <div className="min-w-[90px]">
        <Badge variant="outline" className={cn("text-xs", getWalletFieldBadgeClass(wallet.tradeStatus))}>
          {wallet.tradeStatus || "---"}
        </Badge>
      </div>
      <div className="min-w-[110px]">
        <Badge variant="outline" className={cn("text-xs", getWalletFieldBadgeClass(wallet.fundingSourceLabel))}>
          {wallet.fundingSourceLabel || "---"}
        </Badge>
      </div>
      <div className="min-w-[90px]">
        <Badge variant="outline" className={cn("text-xs", getWalletFieldBadgeClass(wallet.platform))}>
          {wallet.platform || "---"}
        </Badge>
      </div>
      <div className="ml-auto text-right font-mono text-sm">
        {selectedToken ? wallet.selectedTokenBalanceFormatted || "0" : formatSol(wallet.solBalance)}
        {selectedToken && selectedTokenSymbol ? (
          <span className="ml-2 text-xs text-muted-foreground">{selectedTokenSymbol}</span>
        ) : null}
      </div>
    </div>
  )
}
