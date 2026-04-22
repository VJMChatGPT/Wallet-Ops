"use client"

import { useCallback, useState, useEffect, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { Navigation } from "@/components/navigation"
import { StatsCard } from "@/components/stats-card"
import { TokenTable } from "@/components/token-table"
import { TokenSelector } from "@/components/token-selector"
import { WalletBreakdown } from "@/components/wallet-breakdown"
import { SupplyDistributionChart } from "@/components/supply-distribution-chart"
import { DollarSign, Coins, Wallet, TrendingUp } from "lucide-react"
import { formatUsd } from "@/lib/api"
import type {
  AggregatedTokenHolding,
  TrackedToken,
  WalletHoldingSummary,
} from "@/lib/types"

interface HoldingsResponse {
  holdings: unknown[]
  aggregated: AggregatedTokenHolding[]
  walletSummaries: WalletHoldingSummary[]
  totalValueUsd: number
  walletCount: number
  trackedTokenCount: number
}

interface TokensResponse {
  tokens: TrackedToken[]
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

async function readApiResponse(res: Response) {
  const text = await res.text()
  let data: { error?: string } | null = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed with status ${res.status}`)
  }

  return data
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
    fetcher
  )

  // Fetch holdings (optionally filtered by token)
  const holdingsUrl = selectedToken
    ? `/api/holdings?token=${selectedToken}`
    : "/api/holdings"

  const { data, error, isLoading, mutate } = useSWR<HoldingsResponse>(
    holdingsUrl,
    fetcher,
    {
      refreshInterval: 60000,
      revalidateOnFocus: false,
    }
  )

  const handleRefresh = useCallback(() => {
    mutate()
    mutateTokens()
  }, [mutate, mutateTokens])

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

  const totalValue = data?.totalValueUsd || 0
  const tokenCount = data?.aggregated?.length || 0
  const walletCount = data?.walletCount || 0
  const trackedTokens = tokensData?.tokens || []
  const trackedTokenCount = data?.trackedTokenCount ?? trackedTokens.length
  const walletSummaries = data?.walletSummaries || []

  // Get selected token info for display
  const selectedTokenInfo = selectedToken
    ? trackedTokens.find((t) => t.mint === selectedToken)
    : null

  const emptyHoldingsMessage =
    trackedTokenCount === 0
      ? "No tracked tokens yet. Add a token above to start monitoring holdings."
      : walletCount === 0
      ? "No wallets tracked yet. Add a wallet to start monitoring your tracked tokens."
      : selectedTokenInfo
      ? `No holdings found for ${selectedTokenInfo.symbol} in your tracked wallets.`
      : "No holdings found for your tracked tokens in your tracked wallets."
  const selectedAggregatedHolding = selectedToken
    ? data?.aggregated?.find((token) => token.mint === selectedToken)
    : undefined

  // Calculate average 24h change weighted by value
  const weightedChange =
    data?.aggregated && data.aggregated.length > 0 && totalValue > 0
      ? data.aggregated.reduce((acc, token) => {
          if (token.priceChange24h !== null && token.totalValueUsd !== null) {
            return acc + token.priceChange24h * (token.totalValueUsd / totalValue)
          }
          return acc
        }, 0)
      : null

  return (
    <div className="min-h-screen bg-background">
      <Navigation onRefresh={handleRefresh} isRefreshing={isLoading} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            {selectedTokenInfo
              ? `Viewing holdings for ${selectedTokenInfo.symbol}`
              : "Track your Solana token holdings across all wallets"}
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">
              Failed to load holdings. Please check your Helius API key.
            </p>
          </div>
        )}

        {/* Token Selector */}
        <div className="mb-8 rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Token Filter
          </h2>
          <TokenSelector
            tokens={trackedTokens}
            selectedToken={selectedToken}
            onSelectToken={setSelectedToken}
            onAddToken={handleAddToken}
            onDeleteToken={handleDeleteToken}
          />
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title={selectedTokenInfo ? `${selectedTokenInfo.symbol} Value` : "Total Portfolio Value"}
            value={formatUsd(totalValue)}
            icon={DollarSign}
            trend={
              weightedChange !== null
                ? { value: weightedChange, label: "24h" }
                : undefined
            }
          />
          <StatsCard
            title="Unique Tokens"
            value={tokenCount.toString()}
            subtitle={selectedToken ? "Filtered tracked token" : "With tracked holdings"}
            icon={Coins}
          />
          <StatsCard
            title="Tracked Wallets"
            value={walletCount.toString()}
            subtitle="Active wallets"
            icon={Wallet}
          />
          <StatsCard
            title="24h Change"
            value={
              weightedChange !== null
                ? `${weightedChange >= 0 ? "+" : ""}${weightedChange.toFixed(2)}%`
                : "-"
            }
            subtitle="Portfolio weighted"
            icon={TrendingUp}
          />
        </div>

        {selectedTokenInfo && selectedAggregatedHolding && (
          <div className="mb-8">
            <SupplyDistributionChart token={selectedAggregatedHolding} />
          </div>
        )}

        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {selectedTokenInfo
                ? `${selectedTokenInfo.symbol} by Wallet`
                : "Wallet Breakdown"}
            </h2>
            <p className="text-sm text-muted-foreground">
              SOL balance plus tracked token holdings
            </p>
          </div>
          <WalletBreakdown
            wallets={walletSummaries}
            selectedToken={selectedToken}
            selectedTokenSymbol={selectedTokenInfo?.symbol}
            selectedTokenHolding={selectedAggregatedHolding}
            isLoading={isLoading}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {selectedTokenInfo ? `${selectedTokenInfo.symbol} Holdings` : "Holdings"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {tokenCount} token{tokenCount !== 1 ? "s" : ""} found
            </p>
          </div>
          <TokenTable
            tokens={data?.aggregated || []}
            isLoading={isLoading}
            emptyMessage={emptyHoldingsMessage}
          />
        </div>
      </main>
    </div>
  )
}
