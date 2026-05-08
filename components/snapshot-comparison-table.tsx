"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { SolscanLink } from "@/components/solscan-link"
import { formatNumber } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { SnapshotWalletComparisonRow } from "@/lib/types"

interface SnapshotComparisonTableProps {
  wallets: SnapshotWalletComparisonRow[]
  selectedTokenSymbol?: string | null
}

function formatSupplyPercent(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(4)}%` : "-"
}

function formatDeltaSupplyPercent(value: number | null | undefined) {
  return typeof value === "number"
    ? `${value >= 0 ? "+" : ""}${value.toFixed(4)}%`
    : "-"
}

function shortAddress(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-8)}`
}

export function SnapshotComparisonTable({
  wallets,
  selectedTokenSymbol,
}: SnapshotComparisonTableProps) {
  if (wallets.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">No wallets to compare.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead>Wallet</TableHead>
            <TableHead className="text-right">Start Amount</TableHead>
            <TableHead className="text-right">Start %</TableHead>
            <TableHead className="text-right">End Amount</TableHead>
            <TableHead className="text-right">End %</TableHead>
            <TableHead className="text-right">Delta Amount</TableHead>
            <TableHead className="text-right">Delta %</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {wallets.map((wallet) => {
            const increased = wallet.deltaTokenAmount >= 0

            return (
              <TableRow key={wallet.walletAddress} className="border-border">
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {wallet.walletLabel || "Unnamed Wallet"}
                      </p>
                      {selectedTokenSymbol && (
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {selectedTokenSymbol}
                        </Badge>
                      )}
                    </div>
                    <code className="text-xs text-muted-foreground">
                      <SolscanLink
                        address={wallet.walletAddress}
                        label={shortAddress(wallet.walletAddress)}
                      />
                    </code>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {wallet.startPresent
                    ? formatNumber(wallet.startTokenAmount, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })
                    : "-"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {wallet.startPresent
                    ? formatSupplyPercent(wallet.startTokenSupplyPercent)
                    : "-"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {wallet.endPresent
                    ? formatNumber(wallet.endTokenAmount, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })
                    : "-"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {wallet.endPresent
                    ? formatSupplyPercent(wallet.endTokenSupplyPercent)
                    : "-"}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono font-semibold",
                    increased ? "text-primary" : "text-destructive"
                  )}
                >
                  {wallet.deltaTokenAmount >= 0 ? "+" : ""}
                  {formatNumber(wallet.deltaTokenAmount, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-mono",
                    (wallet.deltaTokenSupplyPercent || 0) >= 0
                      ? "text-primary"
                      : "text-destructive"
                  )}
                >
                  {formatDeltaSupplyPercent(wallet.deltaTokenSupplyPercent)}
                </TableCell>
                <TableCell>
                  {!wallet.startPresent ? (
                    <Badge variant="secondary">New</Badge>
                  ) : !wallet.endPresent ? (
                    <Badge variant="outline">Missing</Badge>
                  ) : (
                    <Badge variant="outline">Tracked</Badge>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
