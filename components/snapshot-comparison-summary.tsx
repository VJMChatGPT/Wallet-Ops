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
  launchSummary: {
    planned: {
      startSol: number
      endSol: number
      deltaSol: number
      startTokenAmount: number
      endTokenAmount: number
      deltaTokenAmount: number
      startTokenSupplyPercent: number | null
      endTokenSupplyPercent: number | null
      deltaTokenSupplyPercent: number | null
    }
    used: {
      startSol: number
      endSol: number
      deltaSol: number
      startTokenAmount: number
      endTokenAmount: number
      deltaTokenAmount: number
      startTokenSupplyPercent: number | null
      endTokenSupplyPercent: number | null
      deltaTokenSupplyPercent: number | null
    }
    usedNotPlanned: {
      startSol: number
      endSol: number
      deltaSol: number
      startTokenAmount: number
      endTokenAmount: number
      deltaTokenAmount: number
      startTokenSupplyPercent: number | null
      endTokenSupplyPercent: number | null
      deltaTokenSupplyPercent: number | null
    }
    allWallets: {
      startSol: number
      endSol: number
      deltaSol: number
      startTokenAmount: number
      endTokenAmount: number
      deltaTokenAmount: number
      startTokenSupplyPercent: number | null
      endTokenSupplyPercent: number | null
      deltaTokenSupplyPercent: number | null
    }
  }
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
  launchSummary,
}: SnapshotComparisonSummaryProps) {
  const solIncreased = deltaSolBalance >= 0
  const increased = deltaTokenAmount >= 0

  return (
    <div className="space-y-6">
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

      <div className="grid gap-4 xl:grid-cols-2">
        <GroupComparisonPanel
          title="SOL Launch Groups"
          groups={[
            {
              label: "Planned",
              start: launchSummary.planned.startSol,
              end: launchSummary.planned.endSol,
              delta: launchSummary.planned.deltaSol,
            },
            {
              label: "Used",
              start: launchSummary.used.startSol,
              end: launchSummary.used.endSol,
              delta: launchSummary.used.deltaSol,
            },
            {
              label: "Used not planned",
              start: launchSummary.usedNotPlanned.startSol,
              end: launchSummary.usedNotPlanned.endSol,
              delta: launchSummary.usedNotPlanned.deltaSol,
            },
            {
              label: "All wallets",
              start: launchSummary.allWallets.startSol,
              end: launchSummary.allWallets.endSol,
              delta: launchSummary.allWallets.deltaSol,
            },
          ]}
        />
        <GroupComparisonPanel
          title={`${selectedTokenSymbol || "Token"} Launch Groups`}
          groups={[
            {
              label: "Planned",
              start: launchSummary.planned.startTokenAmount,
              end: launchSummary.planned.endTokenAmount,
              delta: launchSummary.planned.deltaTokenAmount,
              extra: formatPercentValue(launchSummary.planned.deltaTokenSupplyPercent, 4),
            },
            {
              label: "Used",
              start: launchSummary.used.startTokenAmount,
              end: launchSummary.used.endTokenAmount,
              delta: launchSummary.used.deltaTokenAmount,
              extra: formatPercentValue(launchSummary.used.deltaTokenSupplyPercent, 4),
            },
            {
              label: "Used not planned",
              start: launchSummary.usedNotPlanned.startTokenAmount,
              end: launchSummary.usedNotPlanned.endTokenAmount,
              delta: launchSummary.usedNotPlanned.deltaTokenAmount,
              extra: formatPercentValue(
                launchSummary.usedNotPlanned.deltaTokenSupplyPercent,
                4
              ),
            },
            {
              label: "All wallets",
              start: launchSummary.allWallets.startTokenAmount,
              end: launchSummary.allWallets.endTokenAmount,
              delta: launchSummary.allWallets.deltaTokenAmount,
              extra: formatPercentValue(launchSummary.allWallets.deltaTokenSupplyPercent, 4),
            },
          ]}
        />
      </div>
    </div>
  )
}

function GroupComparisonPanel({
  title,
  groups,
}: {
  title: string
  groups: {
    label: string
    start: number
    end: number
    delta: number
    extra?: string
  }[]
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4">
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {groups.map((group) => {
            const increased = group.delta >= 0
            return (
              <div
                key={group.label}
                className={cn(
                  "rounded-md border p-3",
                  increased
                    ? "border-primary/30 bg-primary/5"
                    : "border-destructive/30 bg-destructive/5"
                )}
              >
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatNumber(group.start, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}{" "}
                  →{" "}
                  {formatNumber(group.end, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}
                </p>
                <p
                  className={cn(
                    "mt-2 text-lg font-semibold tracking-tight",
                    increased ? "text-primary" : "text-destructive"
                  )}
                >
                  {group.delta >= 0 ? "+" : ""}
                  {formatNumber(group.delta, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}
                </p>
                {group.extra ? (
                  <p className="mt-1 text-xs text-muted-foreground">{group.extra}</p>
                ) : null}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
