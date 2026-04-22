"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Copy, ExternalLink, Trash2 } from "lucide-react"
import type { TrackedWallet } from "@/lib/types"
import { cn } from "@/lib/utils"

interface WalletCardProps {
  wallet: TrackedWallet
  onDelete?: (id: string) => void
  isDeleting?: boolean
}

export function WalletCard({ wallet, onDelete, isDeleting }: WalletCardProps) {
  const copyAddress = () => {
    navigator.clipboard.writeText(wallet.address)
  }

  const openSolscan = () => {
    window.open(`https://solscan.io/account/${wallet.address}`, "_blank")
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">
              {wallet.label || "Unnamed Wallet"}
            </CardTitle>
            <Badge
              variant={wallet.type === "mine" ? "default" : "secondary"}
              className={cn(
                "text-xs",
                wallet.type === "mine" && "bg-primary/10 text-primary hover:bg-primary/20"
              )}
            >
              {wallet.type === "mine" ? "My Wallet" : "External"}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete?.(wallet.id)}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2">
            <code className="flex-1 truncate text-xs text-muted-foreground">
              {wallet.address}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={copyAddress}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={openSolscan}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View on Solscan
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
