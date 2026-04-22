"use client"

import { Cell, Pie, PieChart } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { AggregatedTokenHolding } from "@/lib/types"

interface SupplyDistributionChartProps {
  token?: AggregatedTokenHolding
}

const chartConfig = {
  mine: {
    label: "My wallets",
    color: "var(--color-primary)",
  },
  others: {
    label: "Others",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "-"
  return `${value.toFixed(4)}%`
}

export function SupplyDistributionChart({ token }: SupplyDistributionChartProps) {
  if (!token) {
    return null
  }

  const minePercent =
    token.holdingsPercentExcludingBondingCurve ?? token.holdingsPercent ?? 0
  const othersPercent =
    token.othersPercentExcludingBondingCurve ??
    Math.max(100 - (token.holdingsPercent || 0), 0)
  const data = [
    {
      key: "mine",
      name: "My wallets",
      value: minePercent,
      balance: token.totalBalanceFormatted,
      fill: "var(--color-mine)",
    },
    {
      key: "others",
      name: "Others",
      value: othersPercent,
      balance:
        token.othersBalanceExcludingBondingCurveFormatted ||
        token.totalSupply.toString(),
      fill: "var(--color-others)",
    },
  ]
  const excludesBondingCurve = token.bondingCurveBalance !== null

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base">
          Supply Distribution
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square h-[260px]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, name, item) => (
                      <div className="flex min-w-36 items-center justify-between gap-4">
                        <span className="text-muted-foreground">
                          {name}
                        </span>
                        <span className="font-mono font-medium">
                          {Number(value).toFixed(4)}%
                        </span>
                        {item.payload?.balance && (
                          <span className="font-mono text-muted-foreground">
                            {item.payload.balance}
                          </span>
                        )}
                      </div>
                    )}
                  />
                }
              />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={68}
                outerRadius={110}
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.key} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>

          <div className="grid content-center gap-4">
            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">My wallets</p>
                  <p className="text-xs text-muted-foreground">
                    {token.totalBalanceFormatted} {token.symbol}
                  </p>
                </div>
                <p className="font-mono text-lg font-semibold text-primary">
                  {formatPercent(minePercent)}
                </p>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Others</p>
                  <p className="text-xs text-muted-foreground">
                    {token.othersBalanceExcludingBondingCurveFormatted || "-"}{" "}
                    {token.symbol}
                  </p>
                </div>
                <p className="font-mono text-lg font-semibold">
                  {formatPercent(othersPercent)}
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Pump.fun bonding curve excluded
                </p>
                <p className="text-right font-mono text-sm">
                  {excludesBondingCurve
                    ? `${token.bondingCurveBalanceFormatted} ${token.symbol}`
                    : "Not detected"}
                </p>
              </div>
              {excludesBondingCurve && (
                <div className="mt-2 flex items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    Bonding curve share
                  </p>
                  <p className="text-right font-mono text-sm">
                    {formatPercent(token.bondingCurvePercent)}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
