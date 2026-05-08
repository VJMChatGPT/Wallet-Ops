import type {
  HoldingsResponseData,
  PortfolioSnapshot,
  PortfolioSnapshotDetail,
  PortfolioSnapshotWallet,
  SnapshotComparisonResponse,
  SnapshotWalletComparisonRow,
  WalletHoldingSummary,
} from "@/lib/types"

function toNumber(value: number | string | null | undefined) {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function buildSnapshotWalletRows(walletSummaries: WalletHoldingSummary[]) {
  return walletSummaries.map((wallet) => ({
    wallet_id: wallet.walletId,
    wallet_label: wallet.walletLabel,
    wallet_address: wallet.walletAddress,
    wallet_type: wallet.walletType,
    trade_status: wallet.tradeStatus,
    funding_cex: wallet.fundingCex,
    platform: wallet.platform,
    planned_date: wallet.plannedDate,
    sol_balance: wallet.solBalance ?? 0,
    usdc_balance: wallet.usdcBalance,
    sol_usd_value: wallet.solUsdValue,
    tracked_tokens_usd_value: wallet.trackedValueUsd,
    total_wallet_usd_value: wallet.totalWalletValueUsd,
    selected_token_mint: wallet.selectedTokenMint,
    selected_token_symbol: wallet.selectedTokenSymbol,
    selected_token_balance: wallet.selectedTokenBalance,
    selected_token_supply_percent: wallet.selectedTokenSupplyPercent,
    token_breakdown: wallet.holdings,
  }))
}

export function buildSnapshotInsert(holdings: HoldingsResponseData, name: string | null) {
  return {
    name,
    total_portfolio_usd: holdings.totalValueUsd,
    wallet_count: holdings.walletSummaries.length,
    total_sol_balance: holdings.totalSolBalance,
    total_usdc_balance: holdings.totalUsdcBalance,
    selected_token_mint: holdings.selectedTokenMint,
    selected_token_symbol: holdings.selectedTokenSymbol,
    total_selected_token_balance: holdings.totalSelectedTokenBalance,
    total_selected_token_supply_percent: holdings.totalSelectedTokenSupplyPercent,
  }
}

export function normalizeSnapshot(snapshot: PortfolioSnapshot): PortfolioSnapshot {
  return {
    ...snapshot,
    total_portfolio_usd: toNumber(snapshot.total_portfolio_usd),
    wallet_count: Number(snapshot.wallet_count),
    total_sol_balance: toNumber(snapshot.total_sol_balance),
    total_usdc_balance: toNumber(snapshot.total_usdc_balance),
    total_selected_token_balance: toNumber(snapshot.total_selected_token_balance),
    total_selected_token_supply_percent:
      snapshot.total_selected_token_supply_percent === null
        ? null
        : toNumber(snapshot.total_selected_token_supply_percent),
  }
}

export function normalizeSnapshotWallet(
  wallet: PortfolioSnapshotWallet
): PortfolioSnapshotWallet {
  return {
    ...wallet,
    trade_status: wallet.trade_status ?? null,
    funding_cex: wallet.funding_cex ?? null,
    platform: wallet.platform ?? null,
    planned_date: wallet.planned_date ?? null,
    sol_balance: toNumber(wallet.sol_balance),
    usdc_balance: toNumber(wallet.usdc_balance),
    sol_usd_value: toNumber(wallet.sol_usd_value),
    tracked_tokens_usd_value: toNumber(wallet.tracked_tokens_usd_value),
    total_wallet_usd_value: toNumber(wallet.total_wallet_usd_value),
    selected_token_balance: toNumber(wallet.selected_token_balance),
    selected_token_supply_percent:
      wallet.selected_token_supply_percent === null
        ? null
        : toNumber(wallet.selected_token_supply_percent),
    token_breakdown: Array.isArray(wallet.token_breakdown)
      ? wallet.token_breakdown
      : [],
  }
}

export function normalizeSnapshotDetail(
  snapshot: PortfolioSnapshot,
  wallets: PortfolioSnapshotWallet[]
): PortfolioSnapshotDetail {
  return {
    snapshot: normalizeSnapshot(snapshot),
    wallets: wallets.map(normalizeSnapshotWallet),
  }
}

export function compareSnapshots(
  fromSnapshot: PortfolioSnapshot,
  toSnapshot: PortfolioSnapshot,
  fromWallets: PortfolioSnapshotWallet[],
  toWallets: PortfolioSnapshotWallet[]
): SnapshotComparisonResponse {
  const normalizedFrom = normalizeSnapshot(fromSnapshot)
  const normalizedTo = normalizeSnapshot(toSnapshot)
  const selectedTokenMint =
    normalizedTo.selected_token_mint || normalizedFrom.selected_token_mint || null
  const selectedTokenSymbol =
    normalizedTo.selected_token_symbol || normalizedFrom.selected_token_symbol || null
  const tokenMismatch =
    Boolean(normalizedFrom.selected_token_mint) &&
    Boolean(normalizedTo.selected_token_mint) &&
    normalizedFrom.selected_token_mint !== normalizedTo.selected_token_mint
  const startSolBalance = toNumber(normalizedFrom.total_sol_balance)
  const endSolBalance = toNumber(normalizedTo.total_sol_balance)
  const deltaSolBalance = endSolBalance - startSolBalance
  const deltaSolPercent =
    startSolBalance > 0 ? (deltaSolBalance / startSolBalance) * 100 : null

  const startTokenAmount = toNumber(normalizedFrom.total_selected_token_balance)
  const endTokenAmount = toNumber(normalizedTo.total_selected_token_balance)
  const deltaTokenAmount = endTokenAmount - startTokenAmount
  const startTokenSupplyPercent =
    normalizedFrom.total_selected_token_supply_percent === null
      ? null
      : toNumber(normalizedFrom.total_selected_token_supply_percent)
  const endTokenSupplyPercent =
    normalizedTo.total_selected_token_supply_percent === null
      ? null
      : toNumber(normalizedTo.total_selected_token_supply_percent)
  const deltaTokenSupplyPercent =
    startTokenSupplyPercent !== null && endTokenSupplyPercent !== null
      ? endTokenSupplyPercent - startTokenSupplyPercent
      : null

  const fromByAddress = new Map(
    fromWallets.map((wallet) => [wallet.wallet_address, normalizeSnapshotWallet(wallet)])
  )
  const toByAddress = new Map(
    toWallets.map((wallet) => [wallet.wallet_address, normalizeSnapshotWallet(wallet)])
  )
  const addresses = Array.from(new Set([...fromByAddress.keys(), ...toByAddress.keys()]))

  const wallets: SnapshotWalletComparisonRow[] = addresses.map((address) => {
    const fromWallet = fromByAddress.get(address)
    const toWallet = toByAddress.get(address)
    const startTokenAmount = toNumber(fromWallet?.selected_token_balance)
    const endTokenAmount = toNumber(toWallet?.selected_token_balance)
    const startTokenSupplyPercent =
      fromWallet?.selected_token_supply_percent === null ||
      fromWallet?.selected_token_supply_percent === undefined
        ? null
        : toNumber(fromWallet.selected_token_supply_percent)
    const endTokenSupplyPercent =
      toWallet?.selected_token_supply_percent === null ||
      toWallet?.selected_token_supply_percent === undefined
        ? null
        : toNumber(toWallet.selected_token_supply_percent)

    return {
      walletAddress: address,
      walletLabel: toWallet?.wallet_label || fromWallet?.wallet_label || null,
      walletType: toWallet?.wallet_type || fromWallet?.wallet_type || null,
      startTokenAmount,
      startTokenSupplyPercent,
      endTokenAmount,
      endTokenSupplyPercent,
      deltaTokenAmount: endTokenAmount - startTokenAmount,
      deltaTokenSupplyPercent:
        startTokenSupplyPercent !== null && endTokenSupplyPercent !== null
          ? endTokenSupplyPercent - startTokenSupplyPercent
          : null,
      startPresent: Boolean(fromWallet),
      endPresent: Boolean(toWallet),
    }
  })

  wallets.sort((a, b) => Math.abs(b.deltaTokenAmount) - Math.abs(a.deltaTokenAmount))

  return {
    from: normalizedFrom,
    to: normalizedTo,
    startSolBalance,
    endSolBalance,
    deltaSolBalance,
    deltaSolPercent,
    selectedTokenMint,
    selectedTokenSymbol,
    startTokenAmount,
    endTokenAmount,
    deltaTokenAmount,
    startTokenSupplyPercent,
    endTokenSupplyPercent,
    deltaTokenSupplyPercent,
    tokenMismatch,
    wallets,
  }
}
