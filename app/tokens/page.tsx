"use client"

import { useCallback, useState } from "react"
import useSWR from "swr"
import { Navigation } from "@/components/navigation"
import { AddTokenDialog } from "@/components/add-token-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Coins,
  Plus,
  TrendingUp,
  BarChart3,
} from "lucide-react"
import Link from "next/link"
import type { TrackedToken } from "@/lib/types"

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

export default function TokensPage() {
  const { data, isLoading, mutate } = useSWR<TokensResponse>("/api/tokens", fetcher)
  const [copiedMint, setCopiedMint] = useState<string | null>(null)
  const [deletingMint, setDeletingMint] = useState<string | null>(null)

  const handleAddToken = useCallback(
    async (mint: string) => {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint }),
      })
      await readApiResponse(res)
      await mutate()
    },
    [mutate]
  )

  const handleDeleteToken = useCallback(
    async (mint: string) => {
      setDeletingMint(mint)
      try {
        const res = await fetch(`/api/tokens?mint=${mint}`, { method: "DELETE" })
        await readApiResponse(res)
        await mutate()
      } finally {
        setDeletingMint(null)
      }
    },
    [mutate]
  )

  const handleCopy = async (mint: string) => {
    await navigator.clipboard.writeText(mint)
    setCopiedMint(mint)
    setTimeout(() => setCopiedMint(null), 2000)
  }

  const tokens = data?.tokens || []

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tokens</h1>
            <p className="mt-1 text-muted-foreground">
              Manage tokens you want to track across your wallets
            </p>
          </div>
          <AddTokenDialog
            onAdd={handleAddToken}
            trigger={
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Token
              </Button>
            }
          />
        </div>

        {tokens.length === 0 && !isLoading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Coins className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No tokens tracked yet</h3>
              <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                Add tokens by pasting their Solana mint address. Once added, you can filter your
                dashboard to see holdings for specific tokens.
              </p>
              <AddTokenDialog
                onAdd={handleAddToken}
                trigger={
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Token
                  </Button>
                }
              />
            </CardContent>
          </Card>
        )}

        {tokens.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tokens.map((token) => (
              <Card key={token.mint} className="group relative overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono">
                        {token.symbol}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopy(token.mint)}
                      >
                        {copiedMint === token.mint ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <a
                        href={`https://solscan.io/token/${token.mint}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-muted"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteToken(token.mint)}
                        disabled={deletingMint === token.mint}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardTitle className="text-lg">{token.name}</CardTitle>
                  <CardDescription className="font-mono text-xs truncate">
                    {token.mint}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/?token=${token.mint}`}>
                      <Button variant="outline" size="sm" className="gap-2">
                        <BarChart3 className="h-3 w-3" />
                        View Holdings
                      </Button>
                    </Link>
                    <Link href={`/token/${token.mint}`}>
                      <Button variant="ghost" size="sm" className="gap-2">
                        <TrendingUp className="h-3 w-3" />
                        Details
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-5 w-16 bg-muted rounded mb-2" />
                  <div className="h-6 w-32 bg-muted rounded mb-1" />
                  <div className="h-4 w-full bg-muted rounded" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 w-28 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
