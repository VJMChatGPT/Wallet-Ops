"use client"

import { use, useCallback } from "react"
import useSWR from "swr"
import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { SolscanLink } from "@/components/solscan-link"
import { StatsCard } from "@/components/stats-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowLeft,
  ExternalLink,
  DollarSign,
  TrendingUp,
  BarChart3,
  Droplets,
  Copy,
} from "lucide-react"
import { formatUsd, formatPercent } from "@/lib/api"
import type { DexScreenerPair, AggregatedTokenHolding } from "@/lib/types"
import { cn } from "@/lib/utils"

interface TokenResponse {
  mint: string
  pair: DexScreenerPair | null
  allPairs: DexScreenerPair[]
}

interface HoldingsResponse {
  aggregated: AggregatedTokenHolding[]
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function TokenPage({
  params,
}: {
  params: Promise<{ mint: string }>
}) {
  const { mint } = use(params)

  const { data: tokenData, isLoading: tokenLoading, mutate: mutateToken } = useSWR<TokenResponse>(
    `/api/token/${mint}`,
    fetcher
  )

  const { data: holdingsData, isLoading: holdingsLoading, mutate: mutateHoldings } = useSWR<HoldingsResponse>(
    `/api/holdings?token=${mint}`,
    fetcher
  )

  const handleRefresh = useCallback(() => {
    mutateToken()
    mutateHoldings()
  }, [mutateToken, mutateHoldings])

  const pair = tokenData?.pair
  const holding = holdingsData?.aggregated?.find((h) => h.mint === mint)
  const isLoading = tokenLoading || holdingsLoading

  const copyMint = () => {
    navigator.clipboard.writeText(mint)
  }

  const openDexScreener = () => {
    if (pair) {
      window.open(pair.url, "_blank")
    } else {
      window.open(`https://dexscreener.com/solana/${mint}`, "_blank")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation onRefresh={handleRefresh} isRefreshing={isLoading} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !pair ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <h3 className="text-lg font-semibold">Token not found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This token may not be listed on DexScreener yet.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                    {pair.baseToken.symbol.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                      {pair.baseToken.symbol}
                    </h1>
                    <p className="text-muted-foreground">{pair.baseToken.name}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                    <SolscanLink
                      address={mint}
                      kind="token"
                      label={`${mint.slice(0, 8)}...${mint.slice(-8)}`}
                    />
                  </code>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyMint}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2" onClick={openDexScreener}>
                  <ExternalLink className="h-4 w-4" />
                  DexScreener
                </Button>
              </div>
            </div>

            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatsCard
                title="Price"
                value={formatUsd(parseFloat(pair.priceUsd))}
                icon={DollarSign}
                trend={
                  pair.priceChange?.h24 !== undefined
                    ? { value: pair.priceChange.h24, label: "24h" }
                    : undefined
                }
              />
              <StatsCard
                title="Market Cap"
                value={formatUsd(pair.marketCap || pair.fdv || null)}
                icon={TrendingUp}
              />
              <StatsCard
                title="24h Volume"
                value={formatUsd(pair.volume?.h24 || null)}
                icon={BarChart3}
              />
              <StatsCard
                title="Liquidity"
                value={formatUsd(pair.liquidity?.usd || null)}
                icon={Droplets}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base">Price Changes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: "5m", value: pair.priceChange?.m5 },
                      { label: "1h", value: pair.priceChange?.h1 },
                      { label: "6h", value: pair.priceChange?.h6 },
                      { label: "24h", value: pair.priceChange?.h24 },
                    ].map((item) => (
                      <div key={item.label} className="text-center">
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p
                          className={cn(
                            "mt-1 text-sm font-semibold",
                            item.value === undefined
                              ? "text-muted-foreground"
                              : item.value >= 0
                              ? "text-primary"
                              : "text-destructive"
                          )}
                        >
                          {formatPercent(item.value ?? null)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base">Transactions (24h)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-primary/10 p-3 text-center">
                      <p className="text-2xl font-bold text-primary">
                        {pair.txns?.h24?.buys?.toLocaleString() || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Buys</p>
                    </div>
                    <div className="rounded-lg bg-destructive/10 p-3 text-center">
                      <p className="text-2xl font-bold text-destructive">
                        {pair.txns?.h24?.sells?.toLocaleString() || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Sells</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {holding && holding.holdingsByWallet.length > 0 && (
              <Card className="mt-6 bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base">Your Holdings</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Wallet</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">% Supply</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {holding.holdingsByWallet.map((h, idx) => (
                        <TableRow key={idx} className="border-border">
                          <TableCell>
                            <div>
                              <p className="font-medium">{h.walletLabel || "Unnamed"}</p>
                              <code className="text-xs text-muted-foreground">
                                <SolscanLink
                                  address={h.walletAddress}
                                  label={`${h.walletAddress.slice(0, 8)}...${h.walletAddress.slice(-8)}`}
                                />
                              </code>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {h.balanceFormatted}
                          </TableCell>
                          <TableCell className="text-right font-mono text-primary">
                            {holding.totalSupply > 0
                              ? `${((h.balance / holding.totalSupply) * 100).toFixed(4)}%`
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {formatUsd(h.valueUsd)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-border bg-muted/30">
                        <TableCell className="font-semibold">Total</TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {holding.totalBalanceFormatted}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-primary">
                          {holding.holdingsPercent !== null
                            ? `${holding.holdingsPercent.toFixed(4)}%`
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatUsd(holding.totalValueUsd)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {tokenData.allPairs && tokenData.allPairs.length > 1 && (
              <Card className="mt-6 bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-base">All Trading Pairs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {tokenData.allPairs.slice(0, 5).map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-lg border border-border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">{p.dexId}</Badge>
                          <span className="text-sm">
                            {p.baseToken.symbol}/{p.quoteToken.symbol}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-sm">{formatUsd(parseFloat(p.priceUsd))}</p>
                          <p className="text-xs text-muted-foreground">
                            Liq: {formatUsd(p.liquidity?.usd || null)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  )
}
