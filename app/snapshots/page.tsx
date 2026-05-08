"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import useSWR from "swr"
import { Navigation } from "@/components/navigation"
import { SaveSnapshotDialog } from "@/components/save-snapshot-dialog"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { formatNumber } from "@/lib/api"
import { formatSnapshotTimestamp } from "@/lib/dates"
import { jsonFetcher, readApiResponse } from "@/lib/http"
import type { PortfolioSnapshot } from "@/lib/types"

interface SnapshotsResponse {
  snapshots: PortfolioSnapshot[]
}

export default function SnapshotsPage() {
  const { data, error, isLoading, mutate } = useSWR<SnapshotsResponse>(
    "/api/snapshots",
    jsonFetcher
  )
  const snapshots = data?.snapshots || []
  const [fromId, setFromId] = useState<string>("")
  const [toId, setToId] = useState<string>("")
  const compareHref = fromId && toId ? `/snapshots/compare?from=${fromId}&to=${toId}` : ""

  const compareDefaults = useMemo(() => {
    if (snapshots.length >= 2) {
      return {
        from: snapshots[1].id,
        to: snapshots[0].id,
      }
    }

    return {
      from: snapshots[0]?.id || "",
      to: snapshots[0]?.id || "",
    }
  }, [snapshots])

  useEffect(() => {
    if (!fromId && compareDefaults.from) {
      setFromId(compareDefaults.from)
    }
    if (!toId && compareDefaults.to) {
      setToId(compareDefaults.to)
    }
  }, [compareDefaults, fromId, toId])

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this snapshot permanently?")) {
      return
    }
    await readApiResponse<{ success: true }>(
      await fetch(`/api/snapshots/${id}`, { method: "DELETE" })
    )
    await mutate()
  }

  const handleRefresh = async () => {
    await mutate()
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation onRefresh={handleRefresh} isRefreshing={isLoading} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Snapshots</h1>
            <p className="mt-1 text-muted-foreground">
              Freeze wallet ownership before and after launches, then compare the result.
            </p>
          </div>
          <SaveSnapshotDialog onSaved={() => mutate()} />
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              {error.message || "Failed to load snapshots."}
            </p>
          </div>
        )}

        <div className="mb-8 grid gap-4 rounded-lg border border-border bg-card p-4 lg:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2">
            <p className="text-sm font-medium">Compare from</p>
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger>
                <SelectValue placeholder="Select starting snapshot" />
              </SelectTrigger>
              <SelectContent>
                {snapshots.map((snapshot) => (
                  <SelectItem key={snapshot.id} value={snapshot.id}>
                    {(snapshot.name || "Untitled snapshot") + " - " + formatSnapshotTimestamp(snapshot.created_at)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Compare to</p>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger>
                <SelectValue placeholder="Select ending snapshot" />
              </SelectTrigger>
              <SelectContent>
                {snapshots.map((snapshot) => (
                  <SelectItem key={snapshot.id} value={snapshot.id}>
                    {(snapshot.name || "Untitled snapshot") + " - " + formatSnapshotTimestamp(snapshot.created_at)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            {compareHref ? (
              <Button asChild>
                <Link href={compareHref}>Compare</Link>
              </Button>
            ) : (
              <Button disabled>Compare</Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="mt-4 text-sm text-muted-foreground">Loading snapshots...</p>
          </div>
        ) : snapshots.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <h2 className="text-lg font-semibold">No snapshots yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Save one from the dashboard before a launch, then another afterwards.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Captured</TableHead>
                  <TableHead className="text-right">Total SOL</TableHead>
                  <TableHead>Selected Token</TableHead>
                  <TableHead className="text-right">Token Amount</TableHead>
                  <TableHead className="text-right">% Supply</TableHead>
                  <TableHead className="text-right">Wallets</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((snapshot, index) => {
                  const compareTarget =
                    snapshots[index + 1] || snapshots[index - 1] || null

                  return (
                    <TableRow key={snapshot.id} className="border-border">
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {snapshot.name || "Untitled snapshot"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {snapshot.id}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{formatSnapshotTimestamp(snapshot.created_at)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatNumber(Number(snapshot.total_sol_balance || 0), {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 6,
                        })}
                      </TableCell>
                      <TableCell>
                        {snapshot.selected_token_symbol ? (
                          <Badge variant="outline" className="font-mono">
                            {snapshot.selected_token_symbol}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">No token selected</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {snapshot.selected_token_symbol
                          ? formatNumber(Number(snapshot.total_selected_token_balance || 0), {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 6,
                            })
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold text-primary">
                        {snapshot.total_selected_token_supply_percent !== null
                          ? `${Number(snapshot.total_selected_token_supply_percent).toFixed(4)}%`
                          : "-"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {snapshot.wallet_count}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/snapshots/${snapshot.id}`}>Open</Link>
                          </Button>
                          {compareTarget ? (
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setFromId(compareTarget.id)
                                setToId(snapshot.id)
                              }}
                            >
                              <Link
                                href={`/snapshots/compare?from=${compareTarget.id}&to=${snapshot.id}`}
                              >
                                Compare
                              </Link>
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" disabled>
                              Compare
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDelete(snapshot.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  )
}
