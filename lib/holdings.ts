import {
  formatTokenBalance,
  getAssetMint,
  getBestPair,
  getTokensFromDexScreener,
  getWalletSolBalance,
  getWalletTokenBalances,
} from "@/lib/api"
import {
  mergeTrackedTokensWithDefaults,
  SOLANA_USDC_MINT,
  WRAPPED_SOL_MINT,
} from "@/lib/default-tokens"
import { getPumpFunBondingCurveBalance } from "@/lib/pumpfun"
import { getMergedSheetWallets, getOrCreateMasterSheet, getSheetById } from "@/lib/sheets"
import type {
  AggregatedTokenHolding,
  HoldingsResponseData,
  TokenHolding,
  TrackedToken,
  WalletHoldingSummary,
  WorkbookSheet,
} from "@/lib/types"

interface GetLiveHoldingsOptions {
  sheetId?: string | null
  tokenMint?: string | null
}

export async function getLiveHoldingsData(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  options: GetLiveHoldingsOptions = {}
): Promise<HoldingsResponseData> {
  const { tokenMint = null } = options
  let sheet: WorkbookSheet | null = null

  if (options.sheetId) {
    sheet = await getSheetById(supabase, options.sheetId)
    if (!sheet) {
      throw new Error("Sheet not found")
    }
  } else {
    sheet = await getOrCreateMasterSheet(supabase)
  }

  const { data: trackedTokens, error: tokensError } = await supabase
    .from("tracked_tokens")
    .select("*")

  if (tokensError) {
    throw new Error(tokensError.message)
  }

  const effectiveTrackedTokens = mergeTrackedTokensWithDefaults(
    (trackedTokens || []) as TrackedToken[]
  )
  const trackedTokenByMint = new Map(
    effectiveTrackedTokens.map((trackedToken) => [trackedToken.mint, trackedToken])
  )

  const selectedTokenMint = tokenMint || sheet.token_mint || null
  const selectedTrackedToken = selectedTokenMint
    ? trackedTokenByMint.get(selectedTokenMint) || null
    : null

  const wallets = await getMergedSheetWallets(supabase, sheet)

  if (wallets.length === 0) {
    return {
      sheet,
      holdings: [],
      aggregated: [],
      walletSummaries: [],
      totalValueUsd: 0,
      walletCount: 0,
      trackedTokenCount: effectiveTrackedTokens.length,
      totalSolBalance: 0,
      totalUsdcBalance: 0,
      totalSelectedTokenBalance: 0,
      totalSelectedTokenSupplyPercent: null,
      selectedTokenMint,
      selectedTokenSymbol: selectedTrackedToken?.symbol || sheet.token_symbol || null,
    }
  }

  const allowedMints = new Set<string>([SOLANA_USDC_MINT])
  if (selectedTokenMint) {
    allowedMints.add(selectedTokenMint)
  }

  const allHoldings: TokenHolding[] = []
  const walletBalances = await Promise.all(
    wallets.map(async (wallet) => {
      const [assets, solBalance] = await Promise.all([
        getWalletTokenBalances(wallet.address),
        getWalletSolBalance(wallet.address),
      ])

      return {
        wallet,
        assets,
        solBalance,
      }
    })
  )

  const dexData = await getTokensFromDexScreener([
    WRAPPED_SOL_MINT,
    ...Array.from(allowedMints),
  ])
  const solBestPair = getBestPair(dexData.get(WRAPPED_SOL_MINT) || null)
  const solPriceUsd = solBestPair ? parseFloat(solBestPair.priceUsd) : 0

  for (const { wallet, assets } of walletBalances) {
    for (const asset of assets) {
      const mint = getAssetMint(asset)
      if (!allowedMints.has(mint)) {
        continue
      }

      const pairs = dexData.get(mint)
      const bestPair = getBestPair(pairs || null)
      const defaultToken = trackedTokenByMint.get(mint)
      const decimals = asset.token_info?.decimals || defaultToken?.decimals || 9
      const rawBalance = asset.token_info?.balance || 0
      const actualBalance = rawBalance / Math.pow(10, decimals)
      const isUsdc = mint === SOLANA_USDC_MINT
      const priceUsd = bestPair ? parseFloat(bestPair.priceUsd) : isUsdc ? 1 : null
      const valueUsd = priceUsd !== null ? actualBalance * priceUsd : null
      const totalSupply = asset.token_info?.supply || 0

      allHoldings.push({
        mint,
        name: asset.content?.metadata?.name || defaultToken?.name || "Unknown",
        symbol: asset.content?.metadata?.symbol || defaultToken?.symbol || "???",
        decimals,
        balance: rawBalance,
        balanceFormatted: formatTokenBalance(rawBalance, decimals),
        priceUsd,
        valueUsd,
        marketCap: bestPair?.marketCap || bestPair?.fdv || null,
        priceChange24h: bestPair?.priceChange?.h24 || null,
        volume24h: bestPair?.volume?.h24 || null,
        liquidity: bestPair?.liquidity?.usd || null,
        walletAddress: wallet.address,
        walletLabel: wallet.label,
        totalSupply,
      })
    }
  }

  const aggregatedMap = new Map<string, AggregatedTokenHolding>()

  for (const holding of allHoldings) {
    const existing = aggregatedMap.get(holding.mint)
    if (existing) {
      existing.totalBalance += holding.balance
      existing.totalBalanceFormatted = formatTokenBalance(
        existing.totalBalance,
        existing.decimals
      )
      if (holding.valueUsd !== null) {
        existing.totalValueUsd = (existing.totalValueUsd || 0) + holding.valueUsd
      }
      existing.holdingsByWallet.push({
        walletAddress: holding.walletAddress,
        walletLabel: holding.walletLabel,
        balance: holding.balance,
        balanceFormatted: holding.balanceFormatted,
        valueUsd: holding.valueUsd,
      })
    } else {
      aggregatedMap.set(holding.mint, {
        mint: holding.mint,
        name: holding.name,
        symbol: holding.symbol,
        decimals: holding.decimals,
        totalBalance: holding.balance,
        totalBalanceFormatted: holding.balanceFormatted,
        priceUsd: holding.priceUsd,
        totalValueUsd: holding.valueUsd,
        marketCap: holding.marketCap,
        priceChange24h: holding.priceChange24h,
        volume24h: holding.volume24h,
        liquidity: holding.liquidity,
        totalSupply: holding.totalSupply,
        holdingsPercent: null,
        bondingCurveBalance: null,
        bondingCurveBalanceFormatted: null,
        bondingCurvePercent: null,
        circulatingSupplyExcludingBondingCurve: null,
        othersBalanceExcludingBondingCurve: null,
        othersBalanceExcludingBondingCurveFormatted: null,
        holdingsPercentExcludingBondingCurve: null,
        othersPercentExcludingBondingCurve: null,
        holdingsByWallet: [
          {
            walletAddress: holding.walletAddress,
            walletLabel: holding.walletLabel,
            balance: holding.balance,
            balanceFormatted: holding.balanceFormatted,
            valueUsd: holding.valueUsd,
          },
        ],
      })
    }
  }

  await Promise.all(
    Array.from(aggregatedMap.values()).map(async (token) => {
      if (token.totalSupply > 0) {
        token.holdingsPercent = (token.totalBalance / token.totalSupply) * 100
      }

      const bondingCurve = await getPumpFunBondingCurveBalance(token.mint)
      const bondingCurveBalance = bondingCurve?.balance || 0
      const circulatingSupply = Math.max(token.totalSupply - bondingCurveBalance, 0)
      const othersBalance = Math.max(circulatingSupply - token.totalBalance, 0)

      token.bondingCurveBalance = bondingCurve ? bondingCurveBalance : null
      token.bondingCurveBalanceFormatted = bondingCurve
        ? formatTokenBalance(bondingCurveBalance, token.decimals)
        : null
      token.bondingCurvePercent =
        bondingCurve && token.totalSupply > 0
          ? (bondingCurveBalance / token.totalSupply) * 100
          : null
      token.circulatingSupplyExcludingBondingCurve =
        circulatingSupply > 0 ? circulatingSupply : null
      token.othersBalanceExcludingBondingCurve =
        circulatingSupply > 0 ? othersBalance : null
      token.othersBalanceExcludingBondingCurveFormatted =
        circulatingSupply > 0
          ? formatTokenBalance(othersBalance, token.decimals)
          : null
      token.holdingsPercentExcludingBondingCurve =
        circulatingSupply > 0 ? (token.totalBalance / circulatingSupply) * 100 : null
      token.othersPercentExcludingBondingCurve =
        circulatingSupply > 0 ? (othersBalance / circulatingSupply) * 100 : null
    })
  )

  const aggregated = Array.from(aggregatedMap.values()).sort((left, right) => {
    const leftValue = left.totalValueUsd || 0
    const rightValue = right.totalValueUsd || 0
    return rightValue - leftValue
  })

  const selectedAggregatedHolding = selectedTokenMint
    ? aggregated.find((token) => token.mint === selectedTokenMint) || null
    : null

  const walletSummaries: WalletHoldingSummary[] = walletBalances.map(
    ({ wallet, solBalance }) => {
      const holdings = allHoldings
        .filter((holding) => holding.walletAddress === wallet.address)
        .map((holding) => ({
          mint: holding.mint,
          symbol: holding.symbol,
          name: holding.name,
          balance: holding.balance,
          balanceFormatted: holding.balanceFormatted,
          valueUsd: holding.valueUsd,
          holdingsPercent:
            holding.totalSupply > 0
              ? (holding.balance / holding.totalSupply) * 100
              : null,
        }))

      const usdcHolding = holdings.find((holding) => holding.mint === SOLANA_USDC_MINT)
      const selectedHoldingFull = selectedTokenMint
        ? allHoldings.find(
            (holding) =>
              holding.walletAddress === wallet.address &&
              holding.mint === selectedTokenMint
          ) || null
        : null
      const selectedHolding = selectedTokenMint
        ? holdings.find((holding) => holding.mint === selectedTokenMint) || null
        : null
      const solUsdValue = (solBalance?.sol || 0) * solPriceUsd
      const trackedValueUsd = holdings.reduce(
        (sum, holding) => sum + (holding.valueUsd || 0),
        0
      )

      return {
        sheetId: wallet.sheetId,
        sheetType: sheet.type,
        walletId: wallet.walletId,
        walletAddress: wallet.address,
        walletLabel: wallet.label,
        walletType: wallet.type,
        sortOrder: wallet.row_order,
        tradeStatus: wallet.trade_status,
        fundingSourceLabel: wallet.funding_source_label,
        fundingSourceAddress: wallet.funding_source_address,
        fundingLabelSource: wallet.funding_label_source,
        firstFunderAddress: wallet.first_funder_address,
        platform: wallet.platform,
        fundedAt: wallet.funded_at,
        fundingDetectionMethod: wallet.funding_detection_method,
        fundingDetectedAt: wallet.funding_detected_at,
        solBalance: solBalance?.sol ?? null,
        solLamports: solBalance?.lamports ?? null,
        solUsdValue,
        usdcBalance: usdcHolding ? usdcHolding.balance / Math.pow(10, 6) : 0,
        usdcUsdValue: usdcHolding?.valueUsd || 0,
        trackedValueUsd,
        totalWalletValueUsd: solUsdValue + trackedValueUsd,
        selectedTokenMint,
        selectedTokenSymbol: selectedAggregatedHolding?.symbol || sheet.token_symbol || null,
        selectedTokenBalance: selectedHoldingFull
          ? selectedHoldingFull.balance / Math.pow(10, selectedHoldingFull.decimals)
          : 0,
        selectedTokenBalanceFormatted: selectedHolding?.balanceFormatted || "0",
        selectedTokenSupplyPercent: selectedHolding?.holdingsPercent ?? null,
        holdings,
      }
    }
  )

  const totalSolBalance = walletSummaries.reduce(
    (sum, wallet) => sum + (wallet.solBalance || 0),
    0
  )
  const totalUsdcBalance = walletSummaries.reduce(
    (sum, wallet) => sum + wallet.usdcBalance,
    0
  )
  const totalSelectedTokenBalance = selectedAggregatedHolding
    ? selectedAggregatedHolding.totalBalance /
      Math.pow(10, selectedAggregatedHolding.decimals)
    : 0
  const totalSelectedTokenSupplyPercent =
    selectedAggregatedHolding?.holdingsPercent ?? null
  const portfolioTotalValueUsd = walletSummaries.reduce(
    (sum, wallet) => sum + wallet.totalWalletValueUsd,
    0
  )

  return {
    sheet,
    holdings: allHoldings,
    aggregated,
    walletSummaries,
    totalValueUsd: portfolioTotalValueUsd,
    walletCount: walletSummaries.length,
    trackedTokenCount: effectiveTrackedTokens.length,
    totalSolBalance,
    totalUsdcBalance,
    totalSelectedTokenBalance,
    totalSelectedTokenSupplyPercent,
    selectedTokenMint,
    selectedTokenSymbol:
      selectedAggregatedHolding?.symbol || selectedTrackedToken?.symbol || sheet.token_symbol || null,
  }
}
