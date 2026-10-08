"use client"

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
import { SolscanLink } from "@/components/solscan-link"
import type { LaunchPlanWalletView } from "@/lib/types"

interface PlannerWalletTableProps {
  title: string
  description: string
  rows: LaunchPlanWalletView[]
  emptyMessage: string
  selectable?: boolean
  selectedWalletIds?: string[]
  onToggleSelected?: (walletId: string, checked: boolean) => void
  excludedWalletIds?: string[]
  onToggleExcluded?: (walletId: string, checked: boolean) => void
  showReason?: boolean
  showTargets?: boolean
}

function formatAmount(value: number | string | null | undefined, digits = 4) {
  if (value === null || value === undefined) return "-"
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) return "-"
  return formatNumber(numeric, {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  })
}

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(4)}%` : "-"
}

function truncateAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

export function PlannerWalletTable({
  title,
  description,
  rows,
  emptyMessage,
  selectable = false,
  selectedWalletIds = [],
  onToggleSelected,
  excludedWalletIds = [],
  onToggleExcluded,
  showReason = false,
  showTargets = false,
}: PlannerWalletTableProps) {
  const selectedSet = new Set(selectedWalletIds)
  const excludedSet = new Set(excludedWalletIds)

  return (
    <div className="rounded-lg border border-border/70 bg-card/60">
      <div className="border-b border-border/70 px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {selectable ? <TableHead className="w-12">Pick</TableHead> : null}
              {onToggleExcluded ? <TableHead className="w-16">Skip</TableHead> : null}
              <TableHead>Wallet</TableHead>
              <TableHead>SOL</TableHead>
              <TableHead>Selected Token</TableHead>
              <TableHead>% Supply</TableHead>
              {showTargets ? <TableHead>Target</TableHead> : null}
              {showTargets ? <TableHead>Deficit</TableHead> : null}
              {showTargets ? <TableHead>Surplus</TableHead> : null}
              <TableHead>Usage</TableHead>
              {showReason ? <TableHead>Reason</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={
                    5 +
                    (selectable ? 1 : 0) +
                    (onToggleExcluded ? 1 : 0) +
                    (showTargets ? 3 : 0) +
                    (showReason ? 1 : 0)
                  }
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : null}

            {rows.map((row) => (
              <TableRow key={row.wallet_id}>
                {selectable ? (
                  <TableCell>
                    <Checkbox
                      checked={selectedSet.has(row.wallet_id)}
                      onCheckedChange={(checked) =>
                        onToggleSelected?.(row.wallet_id, checked === true)
                      }
                    />
                  </TableCell>
                ) : null}
                {onToggleExcluded ? (
                  <TableCell>
                    <Checkbox
                      checked={excludedSet.has(row.wallet_id)}
                      onCheckedChange={(checked) =>
                        onToggleExcluded(row.wallet_id, checked === true)
                      }
                    />
                  </TableCell>
                ) : null}
                <TableCell className="min-w-[220px]">
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">{row.walletLabel || "Unnamed wallet"}</span>
                    <div className="text-xs text-muted-foreground">
                      <SolscanLink address={row.walletAddress} label={truncateAddress(row.walletAddress)} />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {row.was_used_in_previous_launch ? (
                        <Badge variant="outline" className="text-[10px]">
                          Previous launch
                        </Badge>
                      ) : null}
                      {row.selected_for_next_launch ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Selected
                        </Badge>
                      ) : null}
                      {!row.active ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Inactive
                        </Badge>
                      ) : null}
                      {!row.eligibleForRotation ? (
                        <Badge variant="outline" className="text-[10px]">
                          Rotation off
                        </Badge>
                      ) : null}
                      {excludedSet.has(row.wallet_id) ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Excluded
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{formatAmount(row.current_sol, 6)}</TableCell>
                <TableCell>{formatAmount(row.selectedTokenBalance, 6)}</TableCell>
                <TableCell>{formatPercent(row.selectedTokenSupplyPercent)}</TableCell>
                {showTargets ? <TableCell>{formatAmount(row.target_sol, 6)}</TableCell> : null}
                {showTargets ? <TableCell>{formatAmount(row.deficit_sol, 6)}</TableCell> : null}
                {showTargets ? <TableCell>{formatAmount(row.surplus_sol, 6)}</TableCell> : null}
                <TableCell className="min-w-[180px] text-xs text-muted-foreground">
                  <div>{row.historical_times_used} historical uses</div>
                  <div>{row.historical_last_used_at ? row.historical_last_used_at.slice(0, 10) : "Never used"}</div>
                </TableCell>
                {showReason ? (
                  <TableCell className="min-w-[260px] text-xs text-muted-foreground">
                    {row.selection_reason || "-"}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
