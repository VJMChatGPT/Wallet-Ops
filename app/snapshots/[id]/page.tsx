"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { Navigation } from "@/components/navigation"
import { SnapshotWalletTable } from "@/components/snapshot-wallet-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatNumber } from "@/lib/api"
import { formatSnapshotTimestamp } from "@/lib/dates"
import { jsonFetcher } from "@/lib/http"
import type { PortfolioSnapshotDetail } from "@/lib/types"

function formatSupplyPercent(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "-"
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? `${numericValue.toFixed(4)}%` : "-"
}

export default function SnapshotDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const { data, error, isLoading, mutate } = useSWR<PortfolioSnapshotDetail>(
    id ? `/api/snapshots/${id}` : null,
    jsonFetcher
  )

  return (
    <div className="min-h-screen bg-background">
      <Navigation onRefresh={() => mutate()} isRefreshing={isLoading} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {data?.snapshot.name || "Snapshot Detail"}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {data?.snapshot
                ? `${data.snapshot.sheet_name || "Unknown sheet"} • Captured ${formatSnapshotTimestamp(data.snapshot.created_at)}`
                : "Frozen wallet operations state"}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/snapshots">Back to Snapshots</Link>
          </Button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              {error.message || "Failed to load snapshot."}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-4 text-sm text-muted-foreground">Loading snapshot...</p>
          </div>
        ) : data ? (
          <>
            <div className="mb-8 grid gap-4 xl:grid-cols-5">
              <div className="rounded-lg border border-border bg-card p-6">
                <p className="text-sm font-medium text-muted-foreground">Total SOL</p>
                <p className="mt-2 text-2xl font-bold tracking-tight">
                  {formatNumber(Number(data.snapshot.total_sol_balance || 0), {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-6">
                <p className="text-sm font-medium text-muted-foreground">Total USDC</p>
                <p className="mt-2 text-2xl font-bold tracking-tight">
                  {formatNumber(Number(data.snapshot.total_usdc_balance || 0), {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-6">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Selected token amount
                  </p>
                  {data.snapshot.selected_token_symbol && (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {data.snapshot.selected_token_symbol}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-lg font-semibold tracking-tight">
                  {data.snapshot.selected_token_symbol
                    ? formatNumber(Number(data.snapshot.total_selected_token_balance || 0), {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 6,
                      })
                    : "-"}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-6">
                <p className="text-sm font-medium text-muted-foreground">
                  Total % of supply
                </p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-primary">
                  {formatSupplyPercent(data.snapshot.total_selected_token_supply_percent)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card p-6">
                <p className="text-sm font-medium text-muted-foreground">
                  Wallets captured
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight">
                  {data.snapshot.wallet_count}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {formatSnapshotTimestamp(data.snapshot.created_at)}
                </p>
              </div>
            </div>

            <SnapshotWalletTable
              wallets={data.wallets}
              selectedTokenSymbol={data.snapshot.selected_token_symbol}
            />
          </>
        ) : null}
      </main>
    </div>
  )
}
