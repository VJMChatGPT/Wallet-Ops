"use client"

import { SolscanLink } from "@/components/solscan-link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatNumber } from "@/lib/api"
import type { LaunchPlanTransfer, LaunchPlanWalletView } from "@/lib/types"

interface PlannerTransfersTableProps {
  transfers: LaunchPlanTransfer[]
  walletById: Map<string, LaunchPlanWalletView>
}

function formatAmount(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "-"
  const numeric = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(numeric)) return "-"
  return formatNumber(numeric, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })
}

function truncateAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

function renderWallet(wallet: LaunchPlanWalletView | undefined) {
  if (!wallet) return <span className="text-muted-foreground">Unknown wallet</span>

  return (
    <div className="flex flex-col gap-1">
      <span className="font-medium">{wallet.walletLabel || "Unnamed wallet"}</span>
      <div className="text-xs text-muted-foreground">
        <SolscanLink address={wallet.walletAddress} label={truncateAddress(wallet.walletAddress)} />
      </div>
    </div>
  )
}

export function PlannerTransfersTable({
  transfers,
  walletById,
}: PlannerTransfersTableProps) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/60">
      <div className="border-b border-border/70 px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight">Suggested Funding Plan</h3>
        <p className="text-xs text-muted-foreground">
          Prioritizes one source wallet per destination, but allows a second source only when needed
          to bring that destination up to Min SOL.
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Amount (SOL)</TableHead>
              <TableHead>Source Before</TableHead>
              <TableHead>Source After</TableHead>
              <TableHead>Destination Before</TableHead>
              <TableHead>Destination After</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transfers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No transfers are needed with the current target and reserve settings.
                </TableCell>
              </TableRow>
            ) : null}

            {transfers.map((transfer) => (
              <TableRow key={transfer.id}>
                <TableCell>{renderWallet(walletById.get(transfer.source_wallet_id))}</TableCell>
                <TableCell>{renderWallet(walletById.get(transfer.destination_wallet_id))}</TableCell>
                <TableCell>{formatAmount(transfer.amount_sol)}</TableCell>
                <TableCell>{formatAmount(transfer.source_before)}</TableCell>
                <TableCell>{formatAmount(transfer.source_after)}</TableCell>
                <TableCell>{formatAmount(transfer.destination_before)}</TableCell>
                <TableCell>{formatAmount(transfer.destination_after)}</TableCell>
                <TableCell className="min-w-[220px] text-xs text-muted-foreground">
                  {transfer.reason || "-"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
