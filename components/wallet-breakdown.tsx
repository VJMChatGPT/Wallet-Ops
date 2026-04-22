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
import { formatUsd } from "@/lib/api"
import type { AggregatedTokenHolding, WalletHoldingSummary } from "@/lib/types"

interface WalletBreakdownProps {
  wallets: WalletHoldingSummary[]
  selectedToken: string | null
  selectedTokenSymbol?: string
  selectedTokenHolding?: AggregatedTokenHolding
  isLoading?: boolean
}

function formatSol(value: number | null) {
  if (value === null || value === undefined) return "-"
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  })} SOL`
}

function shortAddress(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-8)}`
}

export function WalletBreakdown({
  wallets,
  selectedToken,
  selectedTokenSymbol,
  selectedTokenHolding,
  isLoading,
}: WalletBreakdownProps) {
  const totalSol = wallets.reduce(
    (sum, wallet) => sum + (wallet.solBalance || 0),
    0
  )
  const totalTrackedValue = wallets.reduce(
    (sum, wallet) => sum + wallet.trackedValueUsd,
    0
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
        <p className="text-muted-foreground">No wallets tracked yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead>Wallet</TableHead>
            <TableHead className="text-right">SOL</TableHead>
            {selectedToken ? (
              <>
                <TableHead className="text-right">
                  {selectedTokenSymbol || "Token"} Balance
                </TableHead>
                <TableHead className="text-right">% Supply</TableHead>
                <TableHead className="text-right">Value</TableHead>
              </>
            ) : (
              <>
                <TableHead className="text-right">Tracked Value</TableHead>
                <TableHead className="text-right">Tracked Tokens</TableHead>
              </>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {wallets.map((wallet) => {
            const tokenHolding = selectedToken
              ? wallet.holdings.find((holding) => holding.mint === selectedToken)
              : null

            return (
              <TableRow key={wallet.walletAddress} className="border-border">
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {wallet.walletLabel || "Unnamed Wallet"}
                      </p>
                      <Badge
                        variant={wallet.walletType === "mine" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {wallet.walletType === "mine" ? "Mine" : "External"}
                      </Badge>
                    </div>
                    <code className="text-xs text-muted-foreground">
                      {shortAddress(wallet.walletAddress)}
                    </code>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatSol(wallet.solBalance)}
                </TableCell>
                {selectedToken ? (
                  <>
                    <TableCell className="text-right font-mono">
                      {tokenHolding?.balanceFormatted || "0"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-primary">
                      {tokenHolding?.holdingsPercent !== null &&
                      tokenHolding?.holdingsPercent !== undefined
                        ? `${tokenHolding.holdingsPercent.toFixed(4)}%`
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium">
                      {formatUsd(tokenHolding?.valueUsd || 0)}
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="text-right font-mono font-medium">
                      {formatUsd(wallet.trackedValueUsd)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {wallet.holdings.length}
                    </TableCell>
                  </>
                )}
              </TableRow>
            )
          })}
          <TableRow className="border-border bg-muted/30">
            <TableCell className="font-semibold">Total</TableCell>
            <TableCell className="text-right font-mono font-semibold">
              {formatSol(totalSol)}
            </TableCell>
            {selectedToken ? (
              <>
                <TableCell className="text-right font-mono font-semibold">
                  {selectedTokenHolding?.totalBalanceFormatted || "0"}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold text-primary">
                  {selectedTokenHolding?.holdingsPercent !== null &&
                  selectedTokenHolding?.holdingsPercent !== undefined
                    ? `${selectedTokenHolding.holdingsPercent.toFixed(4)}%`
                    : "-"}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {formatUsd(selectedTokenHolding?.totalValueUsd || 0)}
                </TableCell>
              </>
            ) : (
              <>
                <TableCell className="text-right font-mono font-semibold">
                  {formatUsd(totalTrackedValue)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold">
                  {wallets.reduce(
                    (sum, wallet) => sum + wallet.holdings.length,
                    0
                  )}
                </TableCell>
              </>
            )}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
