"use client"

import { useCallback, useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { AddWalletDialog } from "@/components/add-wallet-dialog"
import { Navigation } from "@/components/navigation"
import { StatsCard } from "@/components/stats-card"
import { TokenSelector } from "@/components/token-selector"
import { WalletBreakdown } from "@/components/wallet-breakdown"
import { SaveSnapshotDialog } from "@/components/save-snapshot-dialog"
import { Button } from "@/components/ui/button"
import { Coins, Percent, Wallet, DatabaseZap, CircleDollarSign } from "lucide-react"
import { formatNumber } from "@/lib/api"
import { jsonFetcher, readApiResponse } from "@/lib/http"
import type {
  HoldingsResponseData,
  TrackedToken,
  TrackedWallet,
} from "@/lib/types"

function formatPercentValue(value: number | null | undefined, digits = 4) {
  return typeof value === "number" ? `${value.toFixed(digits)}%` : "-"
}

interface TokensResponse {
  tokens: TrackedToken[]
}

// Wrapper component to handle Suspense for useSearchParams
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-16 border-b border-border bg-card" />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="h-9 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-5 w-72 animate-pulse rounded bg-muted" />
        </div>
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-card border border-border" />
          ))}
        </div>
      </main>
    </div>
  )
}

function DashboardContent() {
  const searchParams = useSearchParams()
  const [selectedToken, setSelectedToken] = useState<string | null>(null)

  // Initialize selected token from URL query param
  useEffect(() => {
    const tokenParam = searchParams.get("token")
    if (tokenParam) {
      setSelectedToken(tokenParam)
    }
  }, [searchParams])

  // Fetch tracked tokens
  const { data: tokensData, mutate: mutateTokens } = useSWR<TokensResponse>(
    "/api/tokens",
    jsonFetcher
  )
  const { data: trackedWallets = [], mutate: mutateWallets } = useSWR<TrackedWallet[]>(
    "/api/wallets",
    jsonFetcher
  )

  // Fetch holdings (optionally filtered by token)
  const holdingsUrl = selectedToken
    ? `/api/holdings?token=${selectedToken}`
    : "/api/holdings"

  const { data, error, isLoading, mutate } = useSWR<HoldingsResponseData>(
    holdingsUrl,
    jsonFetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: false,
    }
  )

  const walletCount = data?.walletCount || 0
  const trackedTokens = tokensData?.tokens || []
  const trackedTokenCount = data?.trackedTokenCount ?? trackedTokens.length
  const walletSummaries = data?.walletSummaries || []
  const totalSol = data?.totalSolBalance || 0
  const totalUsdc = data?.totalUsdcBalance || 0
  const totalSelectedTokenBalance = data?.totalSelectedTokenBalance || 0
  const totalSelectedTokenSupplyPercent = data?.totalSelectedTokenSupplyPercent

  // Get selected token info for display
  const selectedTokenInfo = selectedToken
    ? trackedTokens.find((t) => t.mint === selectedToken)
    : null

  const handleRefresh = useCallback(() => {
    mutate()
    mutateTokens()
    mutateWallets()
  }, [mutate, mutateTokens, mutateWallets])

  const handleAddToken = useCallback(
    async (mint: string) => {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint }),
      })
      await readApiResponse(res)
      await mutateTokens()
      // Auto-select the newly added token
      setSelectedToken(mint)
      // Refresh holdings to show the new token's data
      await mutate()
    },
    [mutateTokens, mutate]
  )

  const handleDeleteToken = useCallback(
    async (mint: string) => {
      const res = await fetch(`/api/tokens?mint=${mint}`, { method: "DELETE" })
      await readApiResponse(res)
      await mutateTokens()
      if (selectedToken === mint) {
        setSelectedToken(null)
      }
    },
    [mutateTokens, selectedToken]
  )

  const handleUpdateWallet = useCallback(
    async (
      walletId: string,
      patch: {
        label?: string | null
        trade_status?: string | null
        funding_source_label?: string | null
        platform?: string | null
        funded_at?: string | null
        sort_order?: number | null
      }
    ) => {
      const response = await fetch(`/api/wallets/${walletId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })

      await readApiResponse(response)
      await Promise.all([mutate(), mutateWallets()])
    },
    [mutate, mutateWallets]
  )

  const handleAddWallet = useCallback(
    async (wallet: {
      address: string
      label: string
      type: "mine" | "external"
    }) => {
      const response = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wallet),
      })

      await readApiResponse(response)
      await Promise.all([mutate(), mutateWallets()])
    },
    [mutate, mutateWallets]
  )

  const handleAddWalletsBulk = useCallback(
    async (
      walletsToAdd: {
        address: string
        label: string
        type: "mine" | "external"
        lineNumber: number
      }[]
    ) => {
      const response = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallets: walletsToAdd }),
      })

      const data = await readApiResponse<{
        insertedCount: number
        failures?: { address: string; lineNumber: number | null; error: string }[]
      }>(response)

      await Promise.all([mutate(), mutateWallets()])
      return data
    },
    [mutate, mutateWallets]
  )

  const handleMoveWallet = useCallback(
    async (walletId: string, direction: "up" | "down") => {
      const currentIndex = walletSummaries.findIndex(
        (wallet) => wallet.walletId === walletId
      )

      if (currentIndex === -1) {
        return
      }

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
      if (targetIndex < 0 || targetIndex >= walletSummaries.length) {
        return
      }

      const currentWallet = walletSummaries[currentIndex]
      const targetWallet = walletSummaries[targetIndex]

      if (!currentWallet?.walletId || !targetWallet?.walletId) {
        return
      }

      const currentSortOrder = currentWallet.sortOrder ?? currentIndex
      const targetSortOrder = targetWallet.sortOrder ?? targetIndex

      await Promise.all([
        fetch(`/api/wallets/${currentWallet.walletId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: targetSortOrder }),
        }).then(readApiResponse),
        fetch(`/api/wallets/${targetWallet.walletId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: currentSortOrder }),
        }).then(readApiResponse),
      ])

      await mutate()
    },
    [mutate, walletSummaries]
  )

  return (
    <div className="min-h-screen bg-background">
      <Navigation onRefresh={handleRefresh} isRefreshing={isLoading} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Wallet Manager</h1>
            <p className="mt-1 text-muted-foreground">
              {selectedTokenInfo
                ? `Operational view for ${selectedTokenInfo.symbol}`
                : "Track wallet ownership, operational fields, and launch snapshots"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AddWalletDialog
              existingAddresses={trackedWallets.map((wallet) => wallet.address)}
              onAdd={handleAddWallet}
              onAddBulk={handleAddWalletsBulk}
            />
            <Button asChild variant="outline" size="sm">
              <Link href="/snapshots">Snapshots</Link>
            </Button>
            <SaveSnapshotDialog
              selectedTokenMint={selectedToken}
              selectedTokenSymbol={selectedTokenInfo?.symbol || null}
              onSaved={() => mutate()}
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              {error.message || "Failed to load holdings."}
            </p>
          </div>
        )}

        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Selected Token
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                SOL and USDC are always loaded. Pick one tracked token to analyze amount and % of supply.
              </p>
            </div>
          </div>
          <TokenSelector
            tokens={trackedTokens}
            selectedToken={selectedToken}
            onSelectToken={setSelectedToken}
            onAddToken={handleAddToken}
            onDeleteToken={handleDeleteToken}
          />
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatsCard
            title="Total SOL"
            value={formatNumber(totalSol, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })}
            subtitle="Across all tracked wallets"
            icon={CircleDollarSign}
          />
          <StatsCard
            title="Total USDC"
            value={formatNumber(totalUsdc, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            subtitle="Built-in default token"
            icon={Coins}
          />
          <StatsCard
            title={selectedTokenInfo ? `${selectedTokenInfo.symbol} Amount` : "Selected Token Amount"}
            value={
              selectedTokenInfo
                ? formatNumber(totalSelectedTokenBalance, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })
                : "-"
            }
            subtitle={
              selectedTokenInfo
                ? "Accumulated across your wallets"
                : "Select a token to analyze supply ownership"
            }
            icon={DatabaseZap}
          />
          <StatsCard
            title={selectedTokenInfo ? `${selectedTokenInfo.symbol} % Held` : "Selected Token % Held"}
            value={
              selectedTokenInfo
                ? formatPercentValue(totalSelectedTokenSupplyPercent)
                : "-"
            }
            subtitle={`${walletCount} wallet${walletCount !== 1 ? "s" : ""} tracked`}
            icon={Percent}
          />
          <StatsCard
            title="Tracked Wallets"
            value={walletCount.toString()}
            subtitle={`${trackedTokenCount} tokens available`}
            icon={Wallet}
          />
        </div>

        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {selectedTokenInfo
                ? `${selectedTokenInfo.symbol} by Wallet`
                : "Wallet Breakdown"}
            </h2>
            <p className="text-sm text-muted-foreground">
              Spreadsheet-style operations view focused on balances, funding, and supply ownership
            </p>
          </div>
          <WalletBreakdown
            wallets={walletSummaries}
            selectedToken={selectedToken}
            selectedTokenSymbol={selectedTokenInfo?.symbol}
            isLoading={isLoading}
            onUpdateWallet={handleUpdateWallet}
            onMoveWallet={handleMoveWallet}
          />
        </div>
      </main>
    </div>
  )
}
