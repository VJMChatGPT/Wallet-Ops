"use client"

import Link from "next/link"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { Navigation } from "@/components/navigation"
import { SnapshotComparisonSummary } from "@/components/snapshot-comparison-summary"
import { SnapshotComparisonTable } from "@/components/snapshot-comparison-table"
import { Button } from "@/components/ui/button"
import { formatSnapshotTimestamp } from "@/lib/dates"
import { jsonFetcher } from "@/lib/http"
import type { SnapshotComparisonResponse } from "@/lib/types"

export default function SnapshotComparePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <SnapshotCompareContent />
    </Suspense>
  )
}

function SnapshotCompareContent() {
  const searchParams = useSearchParams()
  const from = searchParams.get("from")
  const to = searchParams.get("to")
  const comparisonUrl =
    from && to ? `/api/snapshots/compare?from=${from}&to=${to}` : null

  const { data, error, isLoading, mutate } = useSWR<SnapshotComparisonResponse>(
    comparisonUrl,
    jsonFetcher
  )

  return (
    <div className="min-h-screen bg-background">
      <Navigation onRefresh={() => mutate()} isRefreshing={isLoading} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Snapshot Comparison</h1>
            <p className="mt-1 text-muted-foreground">
              {data
                ? `${data.sheetName || "Unknown sheet"} • From ${formatSnapshotTimestamp(data.from.created_at)} to ${formatSnapshotTimestamp(data.to.created_at)}`
                : "Compare two frozen wallet operation captures"}
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/snapshots">Back to Snapshots</Link>
          </Button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              {error.message || "Failed to compare snapshots."}
            </p>
          </div>
        )}

        {!from || !to ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              Pick two snapshots from the snapshots page to compare them here.
            </p>
          </div>
        ) : isLoading ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-4 text-sm text-muted-foreground">Comparing snapshots...</p>
          </div>
        ) : data ? (
          <div className="space-y-8">
            <SnapshotComparisonSummary
              startSolBalance={data.startSolBalance}
              endSolBalance={data.endSolBalance}
              deltaSolBalance={data.deltaSolBalance}
              deltaSolPercent={data.deltaSolPercent}
              selectedTokenSymbol={data.selectedTokenSymbol}
              startTokenAmount={data.startTokenAmount}
              endTokenAmount={data.endTokenAmount}
              deltaTokenAmount={data.deltaTokenAmount}
              startTokenSupplyPercent={data.startTokenSupplyPercent}
              endTokenSupplyPercent={data.endTokenSupplyPercent}
              deltaTokenSupplyPercent={data.deltaTokenSupplyPercent}
            />

            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="text-muted-foreground">Start snapshot</p>
                  <p className="font-medium">{data.from.name || "Untitled snapshot"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">End snapshot</p>
                  <p className="font-medium">{data.to.name || "Untitled snapshot"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Selected token</p>
                  <p className="font-medium">
                    {data.selectedTokenSymbol || "No token selected"}
                  </p>
                </div>
              </div>
            </div>

            <SnapshotComparisonTable
              wallets={data.wallets}
              selectedTokenSymbol={data.selectedTokenSymbol}
            />
          </div>
        ) : null}
      </main>
    </div>
  )
}
