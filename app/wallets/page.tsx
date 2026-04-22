"use client"

import { useCallback } from "react"
import useSWR from "swr"
import { Navigation } from "@/components/navigation"
import { WalletCard } from "@/components/wallet-card"
import { AddWalletDialog } from "@/components/add-wallet-dialog"
import type { TrackedWallet } from "@/lib/types"
import { Wallet } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function WalletsPage() {
  const { data: wallets, error, isLoading, mutate } = useSWR<TrackedWallet[]>(
    "/api/wallets",
    fetcher
  )

  const handleRefresh = useCallback(() => {
    mutate()
  }, [mutate])

  const handleAddWallet = async (wallet: {
    address: string
    label: string
    type: "mine" | "external"
  }) => {
    const response = await fetch("/api/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(wallet),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || "Failed to add wallet")
    }

    mutate()
  }

  const handleDeleteWallet = async (id: string) => {
    const response = await fetch(`/api/wallets?id=${id}`, {
      method: "DELETE",
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || "Failed to delete wallet")
    }

    mutate()
  }

  const myWallets = wallets?.filter((w) => w.type === "mine") || []
  const externalWallets = wallets?.filter((w) => w.type === "external") || []

  return (
    <div className="min-h-screen bg-background">
      <Navigation onRefresh={handleRefresh} isRefreshing={isLoading} />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Wallets</h1>
            <p className="mt-1 text-muted-foreground">
              Manage your tracked Solana wallets
            </p>
          </div>
          <AddWalletDialog onAdd={handleAddWallet} />
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="text-sm text-destructive">Failed to load wallets.</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : wallets?.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Wallet className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">No wallets yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first wallet to start tracking holdings.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {myWallets.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold">My Wallets</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {myWallets.map((wallet) => (
                    <WalletCard
                      key={wallet.id}
                      wallet={wallet}
                      onDelete={handleDeleteWallet}
                    />
                  ))}
                </div>
              </section>
            )}

            {externalWallets.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold">External Wallets</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {externalWallets.map((wallet) => (
                    <WalletCard
                      key={wallet.id}
                      wallet={wallet}
                      onDelete={handleDeleteWallet}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
