"use client"

import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatUsd, formatPercent } from "@/lib/api"
import type { AggregatedTokenHolding } from "@/lib/types"
import { ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react"

interface TokenTableProps {
  tokens: AggregatedTokenHolding[]
  isLoading?: boolean
  emptyMessage?: string
}

export function TokenTable({ tokens, isLoading, emptyMessage }: TokenTableProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <div className="p-8 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-muted-foreground">Loading holdings...</p>
        </div>
      </div>
    )
  }

  if (tokens.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <div className="p-8 text-center">
          <p className="text-muted-foreground">
            {emptyMessage || "No tracked token holdings found."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-[250px]">Token</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead className="text-right">% Supply</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Value</TableHead>
            <TableHead className="text-right">24h</TableHead>
            <TableHead className="text-right">Market Cap</TableHead>
            <TableHead className="text-right">Liquidity</TableHead>
            <TableHead className="text-right">Wallets</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tokens.map((token) => {
            const priceChange = token.priceChange24h
            const TrendIcon =
              priceChange === null
                ? Minus
                : priceChange >= 0
                ? TrendingUp
                : TrendingDown

            return (
              <TableRow key={token.mint} className="border-border">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {token.symbol.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{token.symbol}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {token.name}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono">
                  {token.totalBalanceFormatted}
                </TableCell>
                <TableCell className="text-right font-mono text-primary">
                  {token.holdingsPercent !== null
                    ? `${token.holdingsPercent.toFixed(4)}%`
                    : "-"}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatUsd(token.priceUsd)}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  {formatUsd(token.totalValueUsd)}
                </TableCell>
                <TableCell className="text-right">
                  <div
                    className={cn(
                      "inline-flex items-center gap-1 text-sm font-medium",
                      priceChange === null
                        ? "text-muted-foreground"
                        : priceChange >= 0
                        ? "text-primary"
                        : "text-destructive"
                    )}
                  >
                    <TrendIcon className="h-3 w-3" />
                    {formatPercent(priceChange)}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatUsd(token.marketCap)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground">
                  {formatUsd(token.liquidity)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="secondary" className="font-mono">
                    {token.holdingsByWallet.length}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/token/${token.mint}`}
                    className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
