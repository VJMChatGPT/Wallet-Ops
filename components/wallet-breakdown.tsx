"use client"

import { useCallback, useMemo, useState } from "react"
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatNumber } from "@/lib/api"
import type { WalletHoldingSummary } from "@/lib/types"
import { SortableWalletRow, WalletRowOverlay } from "@/components/wallet-breakdown/sortable-wallet-row"

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

interface WalletBreakdownProps {
  wallets: WalletHoldingSummary[]
  selectedToken: string | null
  selectedTokenSymbol?: string
  isLoading?: boolean
  emptyMessage?: string
  selectable?: boolean
  selectedWalletIds?: string[]
  onToggleWallet?: (walletId: string, checked: boolean) => void
  onToggleAllWallets?: (checked: boolean) => void
  onUpdateWallet?: (walletId: string, patch: WalletPatch) => Promise<void>
  onMoveWallet?: (walletId: string, direction: "up" | "down") => Promise<void>
  onReorderWallets?: (orderedWalletIds: string[]) => Promise<void>
  onRemoveWallet?: (walletId: string) => Promise<void>
  onRefreshFunding?: (walletId: string) => Promise<void>
}

function getRowId(wallet: WalletHoldingSummary) {
  return wallet.walletId || wallet.walletAddress
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

export function WalletBreakdown({
  wallets,
  selectedToken,
  selectedTokenSymbol,
  isLoading,
  emptyMessage,
  selectable,
  selectedWalletIds = [],
  onToggleWallet,
  onToggleAllWallets,
  onUpdateWallet,
  onMoveWallet,
  onReorderWallets,
  onRemoveWallet,
  onRefreshFunding,
}: WalletBreakdownProps) {
  const [activeRowId, setActiveRowId] = useState<string | null>(null)
  const [overRowId, setOverRowId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const walletIds = useMemo(() => wallets.map((wallet) => getRowId(wallet)), [wallets])
  const walletIdSet = useMemo(() => new Set(selectedWalletIds), [selectedWalletIds])
  const walletById = useMemo(
    () => new Map(wallets.map((wallet) => [getRowId(wallet), wallet])),
    [wallets]
  )
  const walletIndexById = useMemo(
    () => new Map(walletIds.map((walletId, index) => [walletId, index])),
    [walletIds]
  )

  const totals = useMemo(
    () => ({
      totalSol: wallets.reduce((sum, wallet) => sum + (wallet.solBalance || 0), 0),
      totalUsdc: wallets.reduce((sum, wallet) => sum + wallet.usdcBalance, 0),
      totalJlUsdc: wallets.reduce((sum, wallet) => sum + wallet.jlUsdcBalance, 0),
      totalSelectedToken: wallets.reduce(
        (sum, wallet) => sum + wallet.selectedTokenBalance,
        0
      ),
      totalSelectedTokenSupplyPercent: wallets.reduce(
        (sum, wallet) => sum + (wallet.selectedTokenSupplyPercent || 0),
        0
      ),
    }),
    [wallets]
  )

  const allSelectableWalletIds = useMemo(
    () =>
      wallets
        .map((wallet) => wallet.walletId)
        .filter((walletId): walletId is string => Boolean(walletId)),
    [wallets]
  )
  const areAllWalletsSelected =
    selectable &&
    allSelectableWalletIds.length > 0 &&
    allSelectableWalletIds.every((walletId) => selectedWalletIds.includes(walletId))

  const activeWallet = activeRowId ? walletById.get(activeRowId) || null : null

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveRowId(String(event.active.id))
    setOverRowId(String(event.active.id))
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverRowId(event.over ? String(event.over.id) : null)
  }, [])

  const handleDragCancel = useCallback(() => {
    setActiveRowId(null)
    setOverRowId(null)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active.id)
      const nextOverId = event.over ? String(event.over.id) : null

      setActiveRowId(null)
      setOverRowId(null)

      if (!nextOverId || activeId === nextOverId || !onReorderWallets) {
        return
      }

      const activeIndex = walletIndexById.get(activeId)
      const overIndex = walletIndexById.get(nextOverId)

      if (activeIndex === undefined || overIndex === undefined || activeIndex === overIndex) {
        return
      }

      const orderedWalletIds = arrayMove(walletIds, activeIndex, overIndex)
      void onReorderWallets(orderedWalletIds)
    },
    [onReorderWallets, walletIds, walletIndexById]
  )

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Loading wallets...</p>
      </div>
    )
  }

  if (wallets.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">{emptyMessage || "No wallets tracked yet."}</p>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card">
            <TableRow className="border-border hover:bg-transparent">
              {selectable && (
                <TableHead className="w-[48px]">
                  <Checkbox
                    checked={areAllWalletsSelected}
                    onCheckedChange={(checked) => {
                      if (onToggleAllWallets) {
                        onToggleAllWallets(Boolean(checked))
                      }
                    }}
                  />
                </TableHead>
              )}
              <TableHead className="w-[56px]">Mover</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Tradeada</TableHead>
              <TableHead>Foundeada</TableHead>
              <TableHead>Plataforma</TableHead>
              <TableHead>Dia</TableHead>
              <TableHead className="text-center">Planned</TableHead>
              <TableHead className="text-center">Used</TableHead>
              <TableHead className="text-right">SOL</TableHead>
              <TableHead className="text-right">USDC</TableHead>
              <TableHead className="text-right">jlUSDC</TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span>Selected Token</span>
                  {selectedTokenSymbol && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {selectedTokenSymbol}
                    </Badge>
                  )}
                </div>
              </TableHead>
              <TableHead className="text-right">% Supply</TableHead>
              {(onMoveWallet || onRemoveWallet) && <TableHead className="w-[60px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            <SortableContext items={walletIds} strategy={verticalListSortingStrategy}>
              {wallets.map((wallet, index) => {
                const rowId = getRowId(wallet)
                const activeIndex =
                  activeRowId !== null ? walletIndexById.get(activeRowId) : undefined
                const overIndex = overRowId !== null ? walletIndexById.get(overRowId) : undefined
                const dropIndicator =
                  activeRowId &&
                  overRowId === rowId &&
                  activeRowId !== rowId &&
                  activeIndex !== undefined &&
                  overIndex !== undefined
                    ? activeIndex < overIndex
                      ? "after"
                      : "before"
                    : null

                return (
                  <SortableWalletRow
                    key={rowId}
                    wallet={wallet}
                    selectedToken={selectedToken}
                    selectable={selectable}
                    selected={wallet.walletId ? walletIdSet.has(wallet.walletId) : false}
                    onToggleWallet={onToggleWallet}
                    onUpdateWallet={onUpdateWallet}
                    onMoveWallet={onMoveWallet}
                    onRemoveWallet={onRemoveWallet}
                    onRefreshFunding={onRefreshFunding}
                    canMoveUp={index > 0}
                    canMoveDown={index < wallets.length - 1}
                    dropIndicator={dropIndicator}
                  />
                )
              })}
            </SortableContext>
            <TableRow className="border-border bg-muted/30">
              {selectable && <TableCell />}
              <TableCell />
              <TableCell className="font-semibold">Total</TableCell>
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell className="text-right font-mono font-semibold">
                {formatSol(totals.totalSol)}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {formatUsdc(totals.totalUsdc)}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {formatUsdc(totals.totalJlUsdc)}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold">
                {selectedToken
                  ? formatNumber(totals.totalSelectedToken, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    })
                  : "-"}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold text-primary">
                {selectedToken ? formatSupplyPercent(totals.totalSelectedTokenSupplyPercent) : "-"}
              </TableCell>
              {(onMoveWallet || onRemoveWallet) && <TableCell />}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeWallet ? (
          <WalletRowOverlay
            wallet={activeWallet}
            selectedToken={selectedToken}
            selectedTokenSymbol={selectedTokenSymbol}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
