"use client"

import { useEffect, useState } from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SolscanLink } from "@/components/solscan-link"
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/api"
import type { WalletHoldingSummary } from "@/lib/types"
import { ChevronDown, ChevronUp } from "lucide-react"
import {
  formatFundedAtInputValue,
  FUNDING_SOURCE_OPTIONS,
  getWalletFieldBadgeClass,
  PLATFORM_OPTIONS,
  TRADE_STATUS_OPTIONS,
} from "@/lib/wallet-fields"

interface WalletBreakdownProps {
  wallets: WalletHoldingSummary[]
  selectedToken: string | null
  selectedTokenSymbol?: string
  isLoading?: boolean
  onUpdateWallet?: (
    walletId: string,
    patch: {
      label?: string | null
      trade_status?: string | null
      funding_source_label?: string | null
      platform?: string | null
      funded_at?: string | null
      sort_order?: number | null
    }
  ) => Promise<void>
  onMoveWallet?: (walletId: string, direction: "up" | "down") => Promise<void>
}

function shortAddress(address: string) {
  return `${address.slice(0, 8)}...${address.slice(-8)}`
}

function formatSol(value: number | null) {
  if (value === null || value === undefined) return "-"

  return formatNumber(value, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  })
}

function formatUsdc(value: number) {
  return formatNumber(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatSupplyPercent(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(4)}%` : "-"
}

export function WalletBreakdown({
  wallets,
  selectedToken,
  selectedTokenSymbol,
  isLoading,
  onUpdateWallet,
  onMoveWallet,
}: WalletBreakdownProps) {
  const totalSol = wallets.reduce((sum, wallet) => sum + (wallet.solBalance || 0), 0)
  const totalUsdc = wallets.reduce((sum, wallet) => sum + wallet.usdcBalance, 0)
  const totalSelectedToken = wallets.reduce(
    (sum, wallet) => sum + wallet.selectedTokenBalance,
    0
  )
  const totalSelectedTokenSupplyPercent = wallets.reduce(
    (sum, wallet) => sum + (wallet.selectedTokenSupplyPercent || 0),
    0
  )

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="mt-4 text-sm text-muted-foreground">Loading wallets...</p>
      </div>
    )
  }

  if (wallets.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-muted-foreground">No wallets tracked yet.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-[72px]">Orden</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Tradeada</TableHead>
            <TableHead>Foundeada</TableHead>
            <TableHead>Plataforma</TableHead>
            <TableHead>Dia</TableHead>
            <TableHead className="text-right">SOL</TableHead>
            <TableHead className="text-right">USDC</TableHead>
            <TableHead className="text-right">
              <div className="flex items-center justify-end gap-2">
                <span>Selected Token</span>
                {selectedTokenSymbol && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {selectedTokenSymbol}
                  </Badge>
                )}
              </div>
            </TableHead>
            <TableHead className="text-right">% Supply</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {wallets.map((wallet, index) => (
            <TableRow key={wallet.walletAddress} className="border-border">
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() =>
                      wallet.walletId && onMoveWallet
                        ? void onMoveWallet(wallet.walletId, "up")
                        : undefined
                    }
                    disabled={index === 0 || !wallet.walletId || !onMoveWallet}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() =>
                      wallet.walletId && onMoveWallet
                        ? void onMoveWallet(wallet.walletId, "down")
                        : undefined
                    }
                    disabled={
                      index === wallets.length - 1 || !wallet.walletId || !onMoveWallet
                    }
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
              <TableCell className="font-medium">
                <WalletLabelInput
                  walletId={wallet.walletId}
                  value={wallet.walletLabel}
                  onSave={onUpdateWallet}
                />
              </TableCell>
              <TableCell>
                <code className="text-xs text-muted-foreground">
                  <SolscanLink
                    address={wallet.walletAddress}
                    label={shortAddress(wallet.walletAddress)}
                  />
                </code>
              </TableCell>
              <TableCell>
                <WalletFieldSelect
                  value={wallet.tradeStatus}
                  options={TRADE_STATUS_OPTIONS}
                  placeholder="---"
                  onChange={(value) =>
                    wallet.walletId && onUpdateWallet
                      ? onUpdateWallet(wallet.walletId, { trade_status: value })
                      : Promise.resolve()
                  }
                />
              </TableCell>
              <TableCell>
                <WalletFieldSelect
                  value={wallet.fundingSourceLabel}
                  options={FUNDING_SOURCE_OPTIONS}
                  placeholder="---"
                  onChange={(value) =>
                    wallet.walletId && onUpdateWallet
                      ? onUpdateWallet(wallet.walletId, {
                          funding_source_label: value,
                        })
                      : Promise.resolve()
                  }
                />
                {wallet.firstFunderAddress && (
                  <div className="mt-1 space-y-1">
                    <p className="max-w-[120px] truncate font-mono text-[10px] text-muted-foreground">
                      <SolscanLink
                        address={wallet.firstFunderAddress}
                        label={shortAddress(wallet.firstFunderAddress)}
                      />
                    </p>
                    {wallet.fundingLabelSource && (
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">
                        {wallet.fundingLabelSource}
                      </p>
                    )}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <WalletFieldSelect
                  value={wallet.platform}
                  options={PLATFORM_OPTIONS}
                  placeholder="---"
                  onChange={(value) =>
                    wallet.walletId && onUpdateWallet
                      ? onUpdateWallet(wallet.walletId, { platform: value })
                      : Promise.resolve()
                  }
                />
              </TableCell>
              <TableCell>
                <Input
                  type="datetime-local"
                  value={formatFundedAtInputValue(wallet.fundedAt)}
                  onChange={(event) => {
                    if (wallet.walletId && onUpdateWallet) {
                      void onUpdateWallet(wallet.walletId, {
                        funded_at: event.target.value || null,
                      })
                    }
                  }}
                  className="h-8 min-w-[168px] border-border bg-transparent text-xs"
                />
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatSol(wallet.solBalance)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatUsdc(wallet.usdcBalance)}
              </TableCell>
              <TableCell className="text-right font-mono font-medium">
                {selectedToken ? wallet.selectedTokenBalanceFormatted || "0" : "-"}
              </TableCell>
              <TableCell className="text-right font-mono font-semibold text-primary">
                {selectedToken ? formatSupplyPercent(wallet.selectedTokenSupplyPercent) : "-"}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="border-border bg-muted/30">
            <TableCell />
            <TableCell className="font-semibold">Total</TableCell>
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell />
            <TableCell className="text-right font-mono font-semibold">
              {formatSol(totalSol)}
            </TableCell>
            <TableCell className="text-right font-mono font-semibold">
              {formatUsdc(totalUsdc)}
            </TableCell>
            <TableCell className="text-right font-mono font-semibold">
              {selectedToken
                ? formatNumber(totalSelectedToken, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  })
                : "-"}
            </TableCell>
            <TableCell className="text-right font-mono font-semibold text-primary">
              {selectedToken ? formatSupplyPercent(totalSelectedTokenSupplyPercent) : "-"}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}

function WalletLabelInput({
  walletId,
  value,
  onSave,
}: {
  walletId: string | null
  value: string | null
  onSave?: (
    walletId: string,
    patch: {
      label?: string | null
      trade_status?: string | null
      funding_source_label?: string | null
      platform?: string | null
      funded_at?: string | null
      sort_order?: number | null
    }
  ) => Promise<void>
}) {
  const [draft, setDraft] = useState(value || "")

  useEffect(() => {
    setDraft(value || "")
  }, [value])

  const commit = async () => {
    if (!walletId || !onSave) {
      return
    }

    const normalizedCurrent = (value || "").trim()
    const normalizedDraft = draft.trim()

    if (normalizedCurrent === normalizedDraft) {
      return
    }

    await onSave(walletId, {
      label: normalizedDraft || null,
    })
  }

  return (
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        void commit()
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          void commit()
          event.currentTarget.blur()
        }
      }}
      placeholder="Unnamed Wallet"
      className="h-8 min-w-[160px] border-border bg-transparent text-sm font-medium"
    />
  )
}

function WalletFieldSelect({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string | null
  options: readonly string[]
  placeholder: string
  onChange: (value: string | null) => Promise<void>
}) {
  return (
    <Select
      value={value || "__empty__"}
      onValueChange={(nextValue) => {
        void onChange(nextValue === "__empty__" ? null : nextValue)
      }}
    >
      <SelectTrigger
        className={cn(
          "h-8 min-w-[110px] border px-2 text-xs",
          getWalletFieldBadgeClass(value)
        )}
      >
        <SelectValue placeholder={placeholder}>
          <span className="truncate">{value || placeholder}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__empty__">---</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
