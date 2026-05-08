"use client"

import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trash2, ExternalLink, Copy, Check } from "lucide-react"
import { AddTokenDialog } from "./add-token-dialog"
import type { TrackedToken } from "@/lib/types"

interface TokenSelectorProps {
  tokens: TrackedToken[]
  selectedToken: string | null
  onSelectToken: (mint: string | null) => void
  onAddToken: (mint: string) => Promise<void>
  onDeleteToken: (mint: string) => Promise<void>
}

export function TokenSelector({
  tokens,
  selectedToken,
  onSelectToken,
  onAddToken,
  onDeleteToken,
}: TokenSelectorProps) {
  const [copiedMint, setCopiedMint] = useState<string | null>(null)
  const [deletingMint, setDeletingMint] = useState<string | null>(null)

  const handleCopy = async (mint: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(mint)
    setCopiedMint(mint)
    setTimeout(() => setCopiedMint(null), 2000)
  }

  const handleDelete = async (mint: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingMint(mint)
    try {
      await onDeleteToken(mint)
      if (selectedToken === mint) {
        onSelectToken(null)
      }
    } finally {
      setDeletingMint(null)
    }
  }

  const selectedTokenData = tokens.find((t) => t.mint === selectedToken)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Select
            value={selectedToken || "all"}
            onValueChange={(value) => onSelectToken(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Assign a token to this sheet">
                {selectedToken ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {selectedTokenData?.symbol || "???"}
                    </Badge>
                    <span className="truncate">{selectedTokenData?.name || "Unknown"}</span>
                  </div>
                ) : (
                  "No token assigned"
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">ALL</Badge>
                  <span>No token assigned</span>
                </div>
              </SelectItem>
              {tokens.map((token) => (
                <SelectItem key={token.mint} value={token.mint}>
                  <div className="flex items-center justify-between gap-2 w-full">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {token.symbol}
                      </Badge>
                      {token.isDefault && (
                        <Badge variant="outline" className="text-[10px]">
                          DEFAULT
                        </Badge>
                      )}
                      <span className="truncate max-w-[200px]">{token.name}</span>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AddTokenDialog onAdd={onAddToken} />
      </div>

      {tokens.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No extra tracked tokens yet. Add one to use it as the active launch token.
          </p>
          <AddTokenDialog
            onAdd={onAddToken}
            trigger={
              <Button variant="outline" size="sm">
                Add Your First Token
              </Button>
            }
          />
        </div>
      )}

      {tokens.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Tracked Tokens ({tokens.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {tokens.map((token) => (
              <div
                key={token.mint}
                className={`group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                  selectedToken === token.mint
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-muted-foreground/50"
                }`}
              >
                <button
                  onClick={() => onSelectToken(selectedToken === token.mint ? null : token.mint)}
                  className="flex items-center gap-2"
                >
                  <Badge variant="secondary" className="font-mono text-xs">
                    {token.symbol}
                  </Badge>
                  {token.isDefault && (
                    <Badge variant="outline" className="text-[10px]">
                      DEFAULT
                    </Badge>
                  )}
                  <span className="truncate max-w-[120px]">{token.name}</span>
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => handleCopy(token.mint, e)}
                  >
                    {copiedMint === token.mint ? (
                      <Check className="h-3 w-3 text-primary" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <a
                    href={`https://solscan.io/token/${token.mint}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md hover:bg-muted"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  {!token.isDefault && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:text-destructive"
                      onClick={(e) => handleDelete(token.mint, e)}
                      disabled={deletingMint === token.mint}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
