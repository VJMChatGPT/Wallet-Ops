"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import useSWR from "swr"
import { toast } from "sonner"
import { AddWalletDialog } from "@/components/add-wallet-dialog"
import { AddWalletsToSheetDialog } from "@/components/add-wallets-to-sheet-dialog"
import { CreateSheetDialog } from "@/components/create-sheet-dialog"
import { Navigation } from "@/components/navigation"
import { RenameSheetDialog } from "@/components/rename-sheet-dialog"
import { SaveSnapshotDialog } from "@/components/save-snapshot-dialog"
import { StatsCard } from "@/components/stats-card"
import { WalletBreakdown } from "@/components/wallet-breakdown"
import { WorkbookTabs } from "@/components/workbook-tabs"
import { Button } from "@/components/ui/button"
import { ArrowDownAZ, CircleDollarSign, Coins, Shuffle, Wallet } from "lucide-react"
import { formatNumber } from "@/lib/api"
import { jsonFetcher, readApiResponse } from "@/lib/http"
import type {
  HoldingsResponseData,
  TrackedWallet,
  WalletHoldingSummary,
  WorkbookSheetWithWalletCount,
} from "@/lib/types"

interface SheetsResponse {
  sheets: WorkbookSheetWithWalletCount[]
}

function formatPercentValue(value: number | null | undefined, digits = 4) {
  return typeof value === "number" ? `${value.toFixed(digits)}%` : "-"
}

const walletLabelCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
})

function getWalletSortLabel(wallet: WalletHoldingSummary) {
  const label = wallet.walletLabel?.trim()
  if (label) {
    return label
  }

  return wallet.walletAddress
}

function reorderWalletSummaries(
  wallets: WalletHoldingSummary[],
  orderedWalletIds: string[]
) {
  const walletById = new Map(
    wallets.map((wallet) => [
      wallet.walletId || wallet.walletAddress,
      wallet,
    ])
  )

  return orderedWalletIds.reduce<WalletHoldingSummary[]>((orderedWallets, walletId, index) => {
    const wallet = walletById.get(walletId)
    if (!wallet) {
      return orderedWallets
    }

    orderedWallets.push({
      ...wallet,
      sortOrder: index,
    })

    return orderedWallets
  }, [])
}

function applyWalletSummaryPatch(
  wallet: WalletHoldingSummary,
  patch: {
    label?: string | null
    trade_status?: string | null
    funding_source_label?: string | null
    platform?: string | null
    funded_at?: string | null
    planned_for_launch?: boolean
    used_in_launch?: boolean
    used_notes?: string | null
    sort_order?: number | null
  }
) {
  return {
    ...wallet,
    ...(patch.label !== undefined ? { walletLabel: patch.label } : {}),
    ...(patch.trade_status !== undefined ? { tradeStatus: patch.trade_status } : {}),
    ...(patch.funding_source_label !== undefined
      ? { fundingSourceLabel: patch.funding_source_label }
      : {}),
    ...(patch.platform !== undefined ? { platform: patch.platform } : {}),
    ...(patch.funded_at !== undefined ? { fundedAt: patch.funded_at } : {}),
    ...(patch.planned_for_launch !== undefined
      ? { plannedForLaunch: patch.planned_for_launch }
      : {}),
    ...(patch.used_in_launch !== undefined ? { usedInLaunch: patch.used_in_launch } : {}),
    ...(patch.used_notes !== undefined ? { usedNotes: patch.used_notes } : {}),
    ...(patch.sort_order !== undefined ? { sortOrder: patch.sort_order } : {}),
  }
}

function patchWalletSummaries(
  wallets: WalletHoldingSummary[],
  walletId: string,
  patch: {
    label?: string | null
    trade_status?: string | null
    funding_source_label?: string | null
    platform?: string | null
    funded_at?: string | null
    planned_for_launch?: boolean
    used_in_launch?: boolean
    used_notes?: string | null
    sort_order?: number | null
  }
) {
  let changed = false

  const nextWallets = wallets.map((wallet) => {
    if (wallet.walletId !== walletId) {
      return wallet
    }

    changed = true
    return applyWalletSummaryPatch(wallet, patch)
  })

  return changed ? nextWallets : wallets
}

export default function WalletWorkbookPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <WalletWorkbookContent />
    </Suspense>
  )
}

function LaunchMetricCard({
  title,
  value,
  walletCount,
  suffix,
}: {
  title: string
  value: number
  walletCount: number
  suffix?: string
}) {
  return (
    <div className="rounded-md border border-border/70 bg-muted/20 p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{title}</p>
      <p className="mt-2 text-lg font-semibold tracking-tight">
        {formatNumber(value, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6,
        })}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {walletCount} wallet{walletCount !== 1 ? "s" : ""}
        {suffix ? ` • ${suffix}` : ""}
      </p>
    </div>
  )
}

function WalletWorkbookContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sheetParam = searchParams.get("sheet")

  const [selectedWalletIds, setSelectedWalletIds] = useState<string[]>([])
  const [createSheetOpen, setCreateSheetOpen] = useState(false)
  const [renameSheetOpen, setRenameSheetOpen] = useState(false)
  const [addToSheetOpen, setAddToSheetOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<WorkbookSheetWithWalletCount | null>(null)

  const { data: sheetsData, mutate: mutateSheets } = useSWR<SheetsResponse>(
    "/api/sheets",
    jsonFetcher,
    { revalidateOnFocus: false }
  )
  const { data: trackedWallets = [], mutate: mutateWallets } = useSWR<TrackedWallet[]>(
    "/api/wallets",
    jsonFetcher,
    { revalidateOnFocus: false }
  )

  const sheets = sheetsData?.sheets || []
  const activeSheet = useMemo(
    () => sheets.find((sheet) => sheet.id === sheetParam) || sheets[0] || null,
    [sheetParam, sheets]
  )
  const activeSheetId = activeSheet?.id || null

  useEffect(() => {
    if (!activeSheetId) return
    if (sheetParam === activeSheetId) return

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set("sheet", activeSheetId)
    router.replace(`${pathname}?${nextParams.toString()}`)
  }, [activeSheetId, pathname, router, searchParams, sheetParam])

  useEffect(() => {
    setSelectedWalletIds([])
  }, [activeSheetId])

  const holdingsUrl = activeSheetId ? `/api/sheets/${activeSheetId}/holdings` : null
  const {
    data: holdingsData,
    error,
    isLoading,
    mutate: mutateHoldings,
  } = useSWR<HoldingsResponseData>(holdingsUrl, jsonFetcher, {
    revalidateOnFocus: false,
  })

  const walletSummaries = holdingsData?.walletSummaries || []
  const totalSol = holdingsData?.totalSolBalance || 0
  const totalUsdc = holdingsData?.totalUsdcBalance || 0
  const totalJlUsdc = holdingsData?.totalJlUsdcBalance || 0
  const totalDollarValueUsd = holdingsData?.totalDollarValueUsd || 0
  const launchSummary = holdingsData?.launchSummary
  const walletCount = holdingsData?.walletCount || 0
  const isMasterSheet = activeSheet?.type === "master"
  const launchSheets = sheets.filter((sheet) => sheet.type === "launch")

  const handleSelectSheet = useCallback(
    (sheetId: string) => {
      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.set("sheet", sheetId)
      router.push(`${pathname}?${nextParams.toString()}`)
    },
    [pathname, router, searchParams]
  )

  const handleRefresh = useCallback(() => {
    void Promise.all([mutateSheets(), mutateWallets(), mutateHoldings()])
  }, [mutateSheets, mutateWallets, mutateHoldings])

  const handlePatchActiveSheet = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!activeSheetId) {
        return
      }

      await readApiResponse(
        await fetch(`/api/sheets/${activeSheetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
      )

      await Promise.all([mutateSheets(), mutateHoldings()])
    },
    [activeSheetId, mutateHoldings, mutateSheets]
  )

  const handleUpdateSheetWallet = useCallback(
    async (
      walletId: string,
      patch: {
        label?: string | null
        trade_status?: string | null
        funding_source_label?: string | null
        platform?: string | null
        funded_at?: string | null
        planned_for_launch?: boolean
        used_in_launch?: boolean
        used_notes?: string | null
        sort_order?: number | null
      }
    ) => {
      if (!activeSheetId) return

      let previousData: HoldingsResponseData | undefined

      await mutateHoldings(
        (current) => {
          previousData = current || undefined

          if (!current) {
            return current
          }

          return {
            ...current,
            walletSummaries: patchWalletSummaries(current.walletSummaries, walletId, patch),
          }
        },
        {
          revalidate: false,
          populateCache: true,
        }
      )

      try {
        await readApiResponse(
          await fetch(`/api/sheets/${activeSheetId}/wallets/${walletId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...patch,
              row_order: patch.sort_order,
            }),
          })
        )
      } catch (error) {
        if (previousData) {
          await mutateHoldings(previousData, {
            revalidate: false,
            populateCache: true,
          })
        }

        toast.error(
          error instanceof Error ? error.message : "Failed to update wallet row"
        )
      }
    },
    [activeSheetId, mutateHoldings]
  )

  const persistWalletOrder = useCallback(
    async (orderedWalletIds: string[]) => {
      if (!activeSheetId) {
        return
      }

      let previousData: HoldingsResponseData | undefined

      await mutateHoldings(
        (current) => {
          previousData = current || undefined
          if (!current) {
            return current
          }

          return {
            ...current,
            walletSummaries: reorderWalletSummaries(current.walletSummaries, orderedWalletIds),
          }
        },
        {
          revalidate: false,
          populateCache: true,
        }
      )

      try {
        await readApiResponse(
          await fetch(`/api/sheets/${activeSheetId}/wallets/reorder`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletIds: orderedWalletIds }),
          })
        )
      } catch (error) {
        if (previousData) {
          await mutateHoldings(previousData, {
            revalidate: false,
            populateCache: true,
          })
        }
        throw error
      }
    },
    [activeSheetId, mutateHoldings]
  )

  const handleReorderWallets = useCallback(
    async (orderedWalletIds: string[]) => {
      try {
        await persistWalletOrder(orderedWalletIds)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save wallet order"
        )
      }
    },
    [persistWalletOrder]
  )

  const handleMoveWallet = useCallback(
    async (walletId: string, direction: "up" | "down") => {
      const currentIndex = walletSummaries.findIndex((wallet) => wallet.walletId === walletId)
      if (currentIndex === -1) {
        return
      }

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
      if (targetIndex < 0 || targetIndex >= walletSummaries.length) {
        return
      }

      const orderedWalletIds = walletSummaries
        .map((wallet) => wallet.walletId || wallet.walletAddress)
        .filter(Boolean)
      const [movedWalletId] = orderedWalletIds.splice(currentIndex, 1)
      orderedWalletIds.splice(targetIndex, 0, movedWalletId)

      await handleReorderWallets(orderedWalletIds)
    },
    [handleReorderWallets, walletSummaries]
  )

  const handleSortWalletsByLabel = useCallback(async () => {
    if (walletSummaries.length < 2) {
      return
    }

    const orderedWalletIds = [...walletSummaries]
      .sort((left, right) => {
        const byLabel = walletLabelCollator.compare(
          getWalletSortLabel(left),
          getWalletSortLabel(right)
        )

        if (byLabel !== 0) {
          return byLabel
        }

        return walletLabelCollator.compare(left.walletAddress, right.walletAddress)
      })
      .map((wallet) => wallet.walletId || wallet.walletAddress)
      .filter(Boolean)

    try {
      await persistWalletOrder(orderedWalletIds)
      toast.success("Wallets sorted by name")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to sort wallets"
      )
    }
  }, [persistWalletOrder, walletSummaries])

  const handleRemoveWalletFromSheet = useCallback(
    async (walletId: string) => {
      if (!activeSheetId || isMasterSheet) {
        return
      }

      if (!window.confirm("Remove this wallet from the current launch sheet?")) {
        return
      }

      await readApiResponse(
        await fetch(`/api/sheets/${activeSheetId}/wallets/${walletId}`, {
          method: "DELETE",
        })
      )

      setSelectedWalletIds((current) => current.filter((id) => id !== walletId))
      await Promise.all([mutateSheets(), mutateHoldings()])
    },
    [activeSheetId, isMasterSheet, mutateHoldings, mutateSheets]
  )

  const handleRefreshFunding = useCallback(
    async (walletId: string) => {
      const result = await readApiResponse<{ wallet: TrackedWallet }>(
        await fetch(`/api/wallets/${walletId}/refresh-funding`, {
          method: "POST",
        })
      )

      toast.success("Funding refreshed", {
        description:
          result.wallet.funding_source_label || "Funding metadata updated.",
      })
      await Promise.all([mutateWallets(), mutateHoldings()])
    },
    [mutateHoldings, mutateWallets]
  )

  const handleAddWallet = useCallback(
    async (wallet: {
      address: string
      label: string
      type: "mine" | "external"
      visible_in_workbook: boolean
    }) => {
      await readApiResponse(
        await fetch("/api/wallets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(wallet),
        })
      )

      await Promise.all([mutateWallets(), mutateSheets(), mutateHoldings()])
    },
    [mutateHoldings, mutateSheets, mutateWallets]
  )

  const handleAddWalletsBulk = useCallback(
    async (
      walletsToAdd: {
        address: string
        label: string
        type: "mine" | "external"
        visible_in_workbook: boolean
        lineNumber: number
      }[]
    ) => {
      const result = await readApiResponse<{
        insertedCount: number
        failures?: { address: string; lineNumber: number | null; error: string }[]
      }>(
        await fetch("/api/wallets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallets: walletsToAdd }),
        })
      )

      await Promise.all([mutateWallets(), mutateSheets(), mutateHoldings()])
      return result
    },
    [mutateHoldings, mutateSheets, mutateWallets]
  )

  const handleDeleteSelectedWallets = useCallback(async () => {
    if (!isMasterSheet || selectedWalletIds.length === 0) {
      return
    }

    const confirmed = window.confirm(
      `Delete ${selectedWalletIds.length} selected wallet${
        selectedWalletIds.length === 1 ? "" : "s"
      } from Wallet Ops?`
    )

    if (!confirmed) {
      return
    }

    await readApiResponse(
      await fetch(`/api/wallets?ids=${encodeURIComponent(selectedWalletIds.join(","))}`, {
        method: "DELETE",
      })
    )

    setSelectedWalletIds([])
    await Promise.all([mutateWallets(), mutateSheets(), mutateHoldings()])
    toast.success("Selected wallets deleted")
  }, [
    isMasterSheet,
    mutateHoldings,
    mutateSheets,
    mutateWallets,
    selectedWalletIds,
  ])

  const handleToggleWallet = useCallback((walletId: string, checked: boolean) => {
    setSelectedWalletIds((current) => {
      if (checked) {
        return current.includes(walletId) ? current : [...current, walletId]
      }

      return current.filter((id) => id !== walletId)
    })
  }, [])

  const handleToggleAllWallets = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedWalletIds(
          walletSummaries
            .map((wallet) => wallet.walletId)
            .filter((walletId): walletId is string => Boolean(walletId))
        )
      } else {
        setSelectedWalletIds([])
      }
    },
    [walletSummaries]
  )

  const handleDuplicateSheet = useCallback(
    async (sheet: WorkbookSheetWithWalletCount) => {
      const result = await readApiResponse<{ sheet: WorkbookSheetWithWalletCount }>(
        await fetch(`/api/sheets/${sheet.id}/duplicate`, {
          method: "POST",
        })
      )

      await mutateSheets()
      handleSelectSheet(result.sheet.id)
    },
    [handleSelectSheet, mutateSheets]
  )

  const handleArchiveSheet = useCallback(
    async (sheet: WorkbookSheetWithWalletCount) => {
      if (!window.confirm(`Archive "${sheet.name}"?`)) {
        return
      }

      await readApiResponse(await fetch(`/api/sheets/${sheet.id}`, { method: "DELETE" }))
      await mutateSheets()
      if (activeSheetId === sheet.id) {
        setSelectedWalletIds([])
      }
    },
    [activeSheetId, mutateSheets]
  )

  const handleMoveSheet = useCallback(
    async (sheet: WorkbookSheetWithWalletCount, direction: "left" | "right") => {
      const currentIndex = sheets.findIndex((entry) => entry.id === sheet.id)
      const targetIndex = direction === "left" ? currentIndex - 1 : currentIndex + 1

      if (currentIndex === -1 || targetIndex < 1 || targetIndex >= sheets.length) {
        return
      }

      const reordered = [...sheets]
      ;[reordered[currentIndex], reordered[targetIndex]] = [
        reordered[targetIndex],
        reordered[currentIndex],
      ]

      await readApiResponse(
        await fetch("/api/sheets/reorder", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheetIds: reordered.map((entry) => entry.id),
          }),
        })
      )

      await mutateSheets()
    },
    [mutateSheets, sheets]
  )

  return (
    <div className="min-h-screen bg-background">
      <Navigation
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
        logoSrc="/Wallet_Ops_logo_black-bg.png"
      />

      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Wallet Workbook</h1>
              <p className="mt-1 text-muted-foreground">
                One master sheet, many launch sheets, and frozen historical tabs through snapshots.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isMasterSheet && (
                <AddWalletDialog
                  existingAddresses={trackedWallets.map((wallet) => wallet.address)}
                  onAdd={handleAddWallet}
                  onAddBulk={handleAddWalletsBulk}
                />
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => void handleSortWalletsByLabel()}
                disabled={walletSummaries.length < 2}
              >
                <ArrowDownAZ className="h-4 w-4" />
                Sort A-Z
              </Button>
              <Button asChild variant="outline" size="sm" className="gap-2">
                <Link href="/launch-planner">
                  <Shuffle className="h-4 w-4" />
                  Launch Planner
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/snapshots">Snapshots</Link>
              </Button>
              <SaveSnapshotDialog
                sheetId={activeSheetId}
                sheetName={activeSheet?.name || null}
                selectedTokenMint={null}
                selectedTokenSymbol={null}
                onSaved={async () => {
                  await mutateHoldings()
                }}
              />
            </div>
          </div>

          <WorkbookTabs
            sheets={sheets}
            activeSheetId={activeSheetId}
            onSelect={handleSelectSheet}
            onCreate={() => setCreateSheetOpen(true)}
            onRename={(sheet) => {
              setRenameTarget(sheet)
              setRenameSheetOpen(true)
            }}
            onDuplicate={(sheet) => void handleDuplicateSheet(sheet)}
            onArchive={(sheet) => void handleArchiveSheet(sheet)}
            onMoveLeft={(sheet) => void handleMoveSheet(sheet, "left")}
            onMoveRight={(sheet) => void handleMoveSheet(sheet, "right")}
          />
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              {error.message || "Failed to load the current sheet."}
            </p>
          </div>
        )}

        {isMasterSheet && selectedWalletIds.length > 0 && (
          <div className="mb-6 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => setCreateSheetOpen(true)}>
                New Sheet from {selectedWalletIds.length}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={launchSheets.length === 0}
                onClick={() => setAddToSheetOpen(true)}
              >
                Add to Existing Sheet
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void handleDeleteSelectedWallets()}
              >
                Delete Selected
              </Button>
            </div>
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
          <StatsCard
            title="Total SOL"
            value={formatNumber(totalSol, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })}
            subtitle={activeSheet ? activeSheet.name : "Current sheet"}
            icon={CircleDollarSign}
          />
          <StatsCard
            title="Total USDC"
            value={formatNumber(totalUsdc, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            subtitle="Always loaded"
            icon={Coins}
          />
          <StatsCard
            title="Total jlUSDC"
            value={formatNumber(totalJlUsdc, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            subtitle="Lending reserve"
            icon={Coins}
          />
          <StatsCard
            title="Total USD"
            value={formatNumber(totalDollarValueUsd, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            subtitle="SOL + USDC + jlUSDC"
            icon={CircleDollarSign}
          />
          <StatsCard
            title="Wallets"
            value={walletCount.toString()}
            subtitle={isMasterSheet ? "Master source list" : "Launch sheet subset"}
            icon={Wallet}
          />
        </div>

        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                {activeSheet?.name || "Current Sheet"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isMasterSheet
                  ? "This is the permanent wallet database. Select rows here to build launch sheets."
                  : "This launch sheet keeps its own row ordering and operational metadata."}
              </p>
            </div>
          </div>

          {launchSummary && (
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  SOL Groups
                </h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <LaunchMetricCard
                    title="Planned"
                    value={launchSummary.planned.totalSol}
                    walletCount={launchSummary.planned.walletCount}
                  />
                  <LaunchMetricCard
                    title="Used"
                    value={launchSummary.used.totalSol}
                    walletCount={launchSummary.used.walletCount}
                  />
                  <LaunchMetricCard
                    title="Used not planned"
                    value={launchSummary.usedNotPlanned.totalSol}
                    walletCount={launchSummary.usedNotPlanned.walletCount}
                  />
                  <LaunchMetricCard
                    title="All wallets"
                    value={launchSummary.allWallets.totalSol}
                    walletCount={launchSummary.allWallets.walletCount}
                  />
                </div>
              </div>

            </div>
          )}

          <WalletBreakdown
            wallets={walletSummaries}
            selectedToken={null}
            selectedTokenSymbol={undefined}
            showSelectedTokenColumns={false}
            isLoading={isLoading}
            emptyMessage={
              isMasterSheet
                ? trackedWallets.length > 0
                  ? "All wallets are currently hidden from the workbook table. They still count in totals."
                  : "No wallets in the master sheet yet."
                : "No wallets assigned to this launch sheet yet."
            }
            selectable={isMasterSheet}
            selectedWalletIds={selectedWalletIds}
            onToggleWallet={handleToggleWallet}
            onToggleAllWallets={handleToggleAllWallets}
            onUpdateWallet={handleUpdateSheetWallet}
            onMoveWallet={handleMoveWallet}
            onReorderWallets={handleReorderWallets}
            onRemoveWallet={!isMasterSheet ? handleRemoveWalletFromSheet : undefined}
            onRefreshFunding={isMasterSheet ? handleRefreshFunding : undefined}
          />
        </div>
      </main>

      <CreateSheetDialog
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
        selectedWalletIds={selectedWalletIds}
        onCreated={async (sheet) => {
          await mutateSheets()
          handleSelectSheet(sheet.id)
        }}
      />

      <RenameSheetDialog
        sheet={renameTarget}
        open={renameSheetOpen}
        onOpenChange={setRenameSheetOpen}
        onRenamed={async () => {
          await mutateSheets()
        }}
      />

      <AddWalletsToSheetDialog
        open={addToSheetOpen}
        onOpenChange={setAddToSheetOpen}
        sheets={sheets}
        walletIds={selectedWalletIds}
        onAdded={async () => {
          await Promise.all([mutateSheets(), mutateHoldings()])
        }}
      />
    </div>
  )
}
