"use client"

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
import { cn } from "@/lib/utils"
import { formatNumber } from "@/lib/api"
import type { WalletHoldingSummary } from "@/lib/types"
import {
  FUNDING_CEX_OPTIONS,
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
      trade_status?: string | null
      funding_cex?: string | null
      platform?: string | null
      planned_date?: string | null
    }
  ) => Promise<void>
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
            <TableHead>Label</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Tradeada</TableHead>
            <TableHead>Foundeada</TableHead>
            <TableHead>Plataforma</TableHead>
            <TableHead>Dia</TableHead>
            <TableHead>Type</TableHead>
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
          {wallets.map((wallet) => (
            <TableRow key={wallet.walletAddress} className="border-border">
              <TableCell className="font-medium">
                {wallet.walletLabel || "Unnamed Wallet"}
              </TableCell>
              <TableCell>
                <code className="text-xs text-muted-foreground">
                  {shortAddress(wallet.walletAddress)}
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
                  value={wallet.fundingCex}
                  options={FUNDING_CEX_OPTIONS}
                  placeholder="---"
                  onChange={(value) =>
                    wallet.walletId && onUpdateWallet
                      ? onUpdateWallet(wallet.walletId, { funding_cex: value })
                      : Promise.resolve()
                  }
                />
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
                  type="date"
                  value={wallet.plannedDate || ""}
                  onChange={(event) => {
                    if (wallet.walletId && onUpdateWallet) {
                      void onUpdateWallet(wallet.walletId, {
                        planned_date: event.target.value || null,
                      })
                    }
                  }}
                  className="h-8 min-w-[132px] border-border bg-transparent text-xs"
                />
              </TableCell>
              <TableCell>
                <Badge
                  variant={wallet.walletType === "mine" ? "default" : "secondary"}
                  className="text-xs"
                >
                  {wallet.walletType === "mine" ? "Mine" : "External"}
                </Badge>
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
            <TableCell className="font-semibold">Total</TableCell>
            <TableCell />
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
