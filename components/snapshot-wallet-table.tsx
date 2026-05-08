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
import { formatNumber } from "@/lib/api"
import type { PortfolioSnapshotWallet } from "@/lib/types"
import { getWalletFieldBadgeClass } from "@/lib/wallet-fields"
import { cn } from "@/lib/utils"

interface SnapshotWalletTableProps {
  wallets: PortfolioSnapshotWallet[]
  selectedTokenSymbol?: string | null
}

function formatSupplyPercent(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "-"
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? `${numericValue.toFixed(4)}%` : "-"
}

function shortAddress(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-8)}`
}

export function SnapshotWalletTable({
  wallets,
  selectedTokenSymbol,
}: SnapshotWalletTableProps) {
  if (wallets.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">No wallets were captured.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead>Label</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Tradeada</TableHead>
            <TableHead>Foundeada</TableHead>
            <TableHead>Plataforma</TableHead>
            <TableHead>Dia</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">SOL</TableHead>
            <TableHead className="text-right">USDC</TableHead>
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {wallets.map((wallet) => (
            <TableRow key={wallet.id} className="border-border">
              <TableCell className="font-medium">
                {wallet.wallet_label || "Unnamed Wallet"}
              </TableCell>
              <TableCell>
                <code className="text-xs text-muted-foreground">
                  {shortAddress(wallet.wallet_address)}
                </code>
              </TableCell>
              <TableCell>
                <SnapshotFieldBadge value={wallet.trade_status} />
              </TableCell>
              <TableCell>
                <SnapshotFieldBadge value={wallet.funding_cex} />
              </TableCell>
              <TableCell>
                <SnapshotFieldBadge value={wallet.platform} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {wallet.planned_date || "---"}
              </TableCell>
              <TableCell>
                {wallet.wallet_type ? (
                  <Badge
                    variant={wallet.wallet_type === "mine" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {wallet.wallet_type === "mine" ? "Mine" : "External"}
                  </Badge>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatNumber(Number(wallet.sol_balance || 0), {
                  minimumFractionDigits: 4,
                  maximumFractionDigits: 6,
                })}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatNumber(Number(wallet.usdc_balance || 0), {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </TableCell>
              <TableCell className="text-right font-mono font-medium">
                {wallet.selected_token_symbol
                  ? formatNumber(Number(wallet.selected_token_balance || 0), {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    })
                  : "-"}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold text-primary">
                {wallet.selected_token_symbol
                  ? formatSupplyPercent(wallet.selected_token_supply_percent)
                  : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function SnapshotFieldBadge({ value }: { value: string | null }) {
  return (
    <Badge variant="outline" className={cn("text-xs", getWalletFieldBadgeClass(value))}>
      {value || "---"}
    </Badge>
  )
}
