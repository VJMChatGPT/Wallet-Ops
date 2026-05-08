"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/api"

interface SnapshotComparisonSummaryProps {
  startSolBalance: number
  endSolBalance: number
  deltaSolBalance: number
  deltaSolPercent: number | null
  selectedTokenSymbol?: string | null
  startTokenAmount: number
  endTokenAmount: number
  deltaTokenAmount: number
  startTokenSupplyPercent: number | null
  endTokenSupplyPercent: number | null
  deltaTokenSupplyPercent: number | null
}

function formatPercentValue(value: number | null | undefined, digits = 4) {
  return typeof value === "number" ? `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%` : "-"
}

export function SnapshotComparisonSummary({
  startSolBalance,
  endSolBalance,
  deltaSolBalance,
  deltaSolPercent,
  selectedTokenSymbol,
  startTokenAmount,
  endTokenAmount,
  deltaTokenAmount,
  startTokenSupplyPercent,
  endTokenSupplyPercent,
  deltaTokenSupplyPercent,
}: SnapshotComparisonSummaryProps) {
  const solIncreased = deltaSolBalance >= 0
  const increased = deltaTokenAmount >= 0

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground">Start SOL</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">
            {formatNumber(startSolBalance, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Historical total across all wallets
          </p>
        </CardContent>
      </Card>
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground">End SOL</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">
            {formatNumber(endSolBalance, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Historical total across all wallets
          </p>
        </CardContent>
      </Card>
      <Card
        className={cn(
          "border bg-card",
          solIncreased
            ? "border-primary/40 bg-primary/5"
            : "border-destructive/40 bg-destructive/5"
        )}
      >
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground">Delta SOL</p>
          <p
            className={cn(
              "mt-2 text-2xl font-bold tracking-tight",
              solIncreased ? "text-primary" : "text-destructive"
            )}
          >
            {deltaSolBalance >= 0 ? "+" : ""}
            {formatNumber(deltaSolBalance, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })}
          </p>
          <p
            className={cn(
              "mt-2 text-xs font-medium",
              (deltaSolPercent || 0) >= 0 ? "text-primary" : "text-destructive"
            )}
          >
            {formatPercentValue(deltaSolPercent, 2)}
          </p>
        </CardContent>
      </Card>
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-muted-foreground">Start amount</p>
            {selectedTokenSymbol && (
              <Badge variant="outline" className="font-mono text-[10px]">
                {selectedTokenSymbol}
              </Badge>
            )}
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">
            {formatNumber(startTokenAmount, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {typeof startTokenSupplyPercent === "number"
              ? `${startTokenSupplyPercent.toFixed(4)}% of supply`
              : "No supply snapshot"}
          </p>
        </CardContent>
      </Card>
      <Card className="border-border bg-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-muted-foreground">End amount</p>
            {selectedTokenSymbol && (
              <Badge variant="outline" className="font-mono text-[10px]">
                {selectedTokenSymbol}
              </Badge>
            )}
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight">
            {formatNumber(endTokenAmount, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {typeof endTokenSupplyPercent === "number"
              ? `${endTokenSupplyPercent.toFixed(4)}% of supply`
              : "No supply snapshot"}
          </p>
        </CardContent>
      </Card>
      <Card
        className={cn(
          "border bg-card",
          increased
            ? "border-primary/40 bg-primary/5"
            : "border-destructive/40 bg-destructive/5"
        )}
      >
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground">Delta amount</p>
          <p
            className={cn(
              "mt-2 text-2xl font-bold tracking-tight",
              increased ? "text-primary" : "text-destructive"
            )}
          >
            {deltaTokenAmount >= 0 ? "+" : ""}
            {formatNumber(deltaTokenAmount, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })}
          </p>
        </CardContent>
      </Card>
      <Card
        className={cn(
          "border bg-card",
          (deltaTokenSupplyPercent || 0) >= 0
            ? "border-primary/40 bg-primary/5"
            : "border-destructive/40 bg-destructive/5"
        )}
      >
        <CardContent className="p-6">
          <p className="text-sm font-medium text-muted-foreground">Delta % of supply</p>
          <p
            className={cn(
              "mt-2 text-2xl font-bold tracking-tight",
              (deltaTokenSupplyPercent || 0) >= 0
                ? "text-primary"
                : "text-destructive"
            )}
          >
            {formatPercentValue(deltaTokenSupplyPercent, 4)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
