import type {
  HoldingsResponseData,
  LaunchGroupComparison,
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
  return walletSummaries.map((wallet, index) => ({
    row_order: wallet.sortOrder ?? index,
    wallet_id: wallet.walletId,
    wallet_label: wallet.walletLabel,
    wallet_address: wallet.walletAddress,
    wallet_type: wallet.walletType,
    trade_status: wallet.tradeStatus,
    funding_source_label: wallet.fundingSourceLabel,
    funding_source_address: wallet.fundingSourceAddress,
    funding_label_source: wallet.fundingLabelSource,
    first_funder_address: wallet.firstFunderAddress,
    platform: wallet.platform,
    funded_at: wallet.fundedAt,
    planned_for_launch: wallet.plannedForLaunch,
    used_in_launch: wallet.usedInLaunch,
    used_notes: wallet.usedNotes,
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
    sheet_id: holdings.sheet?.id || null,
    sheet_name: holdings.sheet?.name || "Unknown Sheet",
    total_portfolio_usd: holdings.totalValueUsd,
    wallet_count: holdings.walletSummaries.length,
    total_sol_balance: holdings.totalSolBalance,
    total_usdc_balance: holdings.totalUsdcBalance,
    total_sol_planned: holdings.launchSummary.planned.totalSol,
    total_sol_used: holdings.launchSummary.used.totalSol,
    total_sol_used_not_planned: holdings.launchSummary.usedNotPlanned.totalSol,
    selected_token_mint: holdings.selectedTokenMint,
    selected_token_symbol: holdings.selectedTokenSymbol,
    total_selected_token_balance: holdings.totalSelectedTokenBalance,
    total_selected_token_planned: holdings.launchSummary.planned.totalSelectedTokenBalance,
    total_selected_token_used: holdings.launchSummary.used.totalSelectedTokenBalance,
    total_selected_token_used_not_planned:
      holdings.launchSummary.usedNotPlanned.totalSelectedTokenBalance,
    total_selected_token_supply_percent: holdings.totalSelectedTokenSupplyPercent,
    total_selected_token_supply_percent_planned:
      holdings.launchSummary.planned.totalSelectedTokenSupplyPercent,
    total_selected_token_supply_percent_used:
      holdings.launchSummary.used.totalSelectedTokenSupplyPercent,
    total_selected_token_supply_percent_used_not_planned:
      holdings.launchSummary.usedNotPlanned.totalSelectedTokenSupplyPercent,
  }
}

export function normalizeSnapshot(snapshot: PortfolioSnapshot): PortfolioSnapshot {
  return {
    ...snapshot,
    sheet_id: snapshot.sheet_id ?? null,
    sheet_name: snapshot.sheet_name ?? null,
    total_portfolio_usd: toNumber(snapshot.total_portfolio_usd),
    wallet_count: Number(snapshot.wallet_count),
    total_sol_balance: toNumber(snapshot.total_sol_balance),
    total_usdc_balance: toNumber(snapshot.total_usdc_balance),
    total_sol_planned: toNumber(snapshot.total_sol_planned),
    total_sol_used: toNumber(snapshot.total_sol_used),
    total_sol_used_not_planned: toNumber(snapshot.total_sol_used_not_planned),
    total_selected_token_planned: toNumber(snapshot.total_selected_token_planned),
    total_selected_token_used: toNumber(snapshot.total_selected_token_used),
    total_selected_token_used_not_planned: toNumber(
      snapshot.total_selected_token_used_not_planned
    ),
    total_selected_token_balance: toNumber(snapshot.total_selected_token_balance),
    total_selected_token_supply_percent:
      snapshot.total_selected_token_supply_percent === null
        ? null
        : toNumber(snapshot.total_selected_token_supply_percent),
    total_selected_token_supply_percent_planned:
      snapshot.total_selected_token_supply_percent_planned === null
        ? null
        : toNumber(snapshot.total_selected_token_supply_percent_planned),
    total_selected_token_supply_percent_used:
      snapshot.total_selected_token_supply_percent_used === null
        ? null
        : toNumber(snapshot.total_selected_token_supply_percent_used),
    total_selected_token_supply_percent_used_not_planned:
      snapshot.total_selected_token_supply_percent_used_not_planned === null
        ? null
        : toNumber(snapshot.total_selected_token_supply_percent_used_not_planned),
  }
}

export function normalizeSnapshotWallet(
  wallet: PortfolioSnapshotWallet
): PortfolioSnapshotWallet {
  return {
    ...wallet,
    trade_status: wallet.trade_status ?? null,
    row_order:
      wallet.row_order === null || wallet.row_order === undefined
        ? null
        : toNumber(wallet.row_order),
    funding_source_label: wallet.funding_source_label ?? null,
    funding_source_address: wallet.funding_source_address ?? null,
    funding_label_source: wallet.funding_label_source ?? null,
    first_funder_address: wallet.first_funder_address ?? null,
    platform: wallet.platform ?? null,
    funded_at: wallet.funded_at ?? null,
    planned_for_launch: Boolean(wallet.planned_for_launch),
    used_in_launch: Boolean(wallet.used_in_launch),
    used_notes: wallet.used_notes ?? null,
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
  const buildLaunchGroupComparison = (input: {
    startSol: number | string | null | undefined
    endSol: number | string | null | undefined
    startTokenAmount: number | string | null | undefined
    endTokenAmount: number | string | null | undefined
    startTokenSupplyPercent: number | string | null | undefined
    endTokenSupplyPercent: number | string | null | undefined
  }): LaunchGroupComparison => {
    const startSol = toNumber(input.startSol)
    const endSol = toNumber(input.endSol)
    const startTokenAmount = toNumber(input.startTokenAmount)
    const endTokenAmount = toNumber(input.endTokenAmount)
    const normalizedStartSupply =
      input.startTokenSupplyPercent === null || input.startTokenSupplyPercent === undefined
        ? null
        : toNumber(input.startTokenSupplyPercent)
    const normalizedEndSupply =
      input.endTokenSupplyPercent === null || input.endTokenSupplyPercent === undefined
        ? null
        : toNumber(input.endTokenSupplyPercent)

    return {
      startSol,
      endSol,
      deltaSol: endSol - startSol,
      startTokenAmount,
      endTokenAmount,
      deltaTokenAmount: endTokenAmount - startTokenAmount,
      startTokenSupplyPercent: normalizedStartSupply,
      endTokenSupplyPercent: normalizedEndSupply,
      deltaTokenSupplyPercent:
        normalizedStartSupply !== null && normalizedEndSupply !== null
          ? normalizedEndSupply - normalizedStartSupply
          : null,
    }
  }

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
      startPlannedForLaunch: Boolean(fromWallet?.planned_for_launch),
      endPlannedForLaunch: Boolean(toWallet?.planned_for_launch),
      startUsedInLaunch: Boolean(fromWallet?.used_in_launch),
      endUsedInLaunch: Boolean(toWallet?.used_in_launch),
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
    sheetId: normalizedTo.sheet_id || normalizedFrom.sheet_id || null,
    sheetName: normalizedTo.sheet_name || normalizedFrom.sheet_name || null,
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
    launchSummary: {
      planned: buildLaunchGroupComparison({
        startSol: normalizedFrom.total_sol_planned,
        endSol: normalizedTo.total_sol_planned,
        startTokenAmount: normalizedFrom.total_selected_token_planned,
        endTokenAmount: normalizedTo.total_selected_token_planned,
        startTokenSupplyPercent:
          normalizedFrom.total_selected_token_supply_percent_planned,
        endTokenSupplyPercent:
          normalizedTo.total_selected_token_supply_percent_planned,
      }),
      used: buildLaunchGroupComparison({
        startSol: normalizedFrom.total_sol_used,
        endSol: normalizedTo.total_sol_used,
        startTokenAmount: normalizedFrom.total_selected_token_used,
        endTokenAmount: normalizedTo.total_selected_token_used,
        startTokenSupplyPercent:
          normalizedFrom.total_selected_token_supply_percent_used,
        endTokenSupplyPercent:
          normalizedTo.total_selected_token_supply_percent_used,
      }),
      usedNotPlanned: buildLaunchGroupComparison({
        startSol: normalizedFrom.total_sol_used_not_planned,
        endSol: normalizedTo.total_sol_used_not_planned,
        startTokenAmount: normalizedFrom.total_selected_token_used_not_planned,
        endTokenAmount: normalizedTo.total_selected_token_used_not_planned,
        startTokenSupplyPercent:
          normalizedFrom.total_selected_token_supply_percent_used_not_planned,
        endTokenSupplyPercent:
          normalizedTo.total_selected_token_supply_percent_used_not_planned,
      }),
      allWallets: buildLaunchGroupComparison({
        startSol: normalizedFrom.total_sol_balance,
        endSol: normalizedTo.total_sol_balance,
        startTokenAmount: normalizedFrom.total_selected_token_balance,
        endTokenAmount: normalizedTo.total_selected_token_balance,
        startTokenSupplyPercent:
          normalizedFrom.total_selected_token_supply_percent,
        endTokenSupplyPercent:
          normalizedTo.total_selected_token_supply_percent,
      }),
    },
    tokenMismatch,
    wallets,
  }
}
