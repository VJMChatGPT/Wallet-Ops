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
import type {
  AggregatedTokenHolding,
  HoldingsResponseData,
  TokenHolding,
  TrackedToken,
  WalletHoldingSummary,
} from "@/lib/types"

interface GetLiveHoldingsOptions {
  walletType?: string | null
  tokenMint?: string | null
}

export async function getLiveHoldingsData(
  supabase: {
    from: (table: string) => {
      select: (columns?: string) => {
        eq: (column: string, value: string) => unknown
      } & PromiseLike<unknown>
    }
  },
  options: GetLiveHoldingsOptions = {}
): Promise<HoldingsResponseData> {
  const { walletType = null, tokenMint = null } = options

  let query = supabase.from("tracked_wallets").select("*")
  if (walletType) {
    query = query.eq("type", walletType)
  }

  const [
    { data: wallets, error: walletsError },
    { data: trackedTokens, error: tokensError },
  ] = await Promise.all([
    query as Promise<{
      data: {
        id: string
        address: string
        label: string | null
        type: "mine" | "external"
        trade_status: string | null
        funding_cex: string | null
        platform: string | null
        planned_date: string | null
      }[] | null
      error: { message: string } | null
    }>,
    supabase.from("tracked_tokens").select("*") as Promise<{
      data: TrackedToken[] | null
      error: { message: string } | null
    }>,
  ])

  if (walletsError) {
    throw new Error(walletsError.message)
  }

  if (tokensError) {
    throw new Error(tokensError.message)
  }

  const effectiveTrackedTokens = mergeTrackedTokensWithDefaults(
    (trackedTokens || []) as TrackedToken[]
  )
  const trackedTokenMints = new Set(
    effectiveTrackedTokens.map((token) => token.mint)
  )
  const requestedTokenIsTracked = tokenMint ? trackedTokenMints.has(tokenMint) : true
  const allowedMints = tokenMint && requestedTokenIsTracked
    ? new Set([SOLANA_USDC_MINT, tokenMint])
    : trackedTokenMints
  const selectedTrackedToken =
    tokenMint && requestedTokenIsTracked
      ? effectiveTrackedTokens.find((token) => token.mint === tokenMint) || null
      : null

  if (!wallets || wallets.length === 0) {
    return {
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
      selectedTokenMint: selectedTrackedToken?.mint || null,
      selectedTokenSymbol: selectedTrackedToken?.symbol || null,
    }
  }

  const effectiveAllowedMints = requestedTokenIsTracked
    ? allowedMints
    : new Set<string>([SOLANA_USDC_MINT])
  const allHoldings: TokenHolding[] = []

  const walletBalances = await Promise.all(
    wallets.map(async (wallet) => {
      const [assets, solBalance] = await Promise.all([
        getWalletTokenBalances(wallet.address),
        getWalletSolBalance(wallet.address),
      ])
      return { wallet, assets, solBalance }
    })
  )

  const dexData = await getTokensFromDexScreener([
    WRAPPED_SOL_MINT,
    ...Array.from(effectiveAllowedMints),
  ])
  const solBestPair = getBestPair(dexData.get(WRAPPED_SOL_MINT) || null)
  const solPriceUsd = solBestPair ? parseFloat(solBestPair.priceUsd) : 0

  for (const { wallet, assets } of walletBalances) {
    for (const asset of assets) {
      const mint = getAssetMint(asset)
      if (!effectiveAllowedMints.has(mint)) {
        continue
      }

      const pairs = dexData.get(mint)
      const bestPair = getBestPair(pairs || null)
      const decimals = asset.token_info?.decimals || 9
      const rawBalance = asset.token_info?.balance || 0
      const balanceFormatted = formatTokenBalance(rawBalance, decimals)
      const defaultToken = effectiveTrackedTokens.find((token) => token.mint === mint)
      const isUsdc = mint === SOLANA_USDC_MINT
      const priceUsd = bestPair ? parseFloat(bestPair.priceUsd) : isUsdc ? 1 : null
      const actualBalance = rawBalance / Math.pow(10, decimals)
      const valueUsd = priceUsd !== null ? actualBalance * priceUsd : null
      const totalSupply = asset.token_info?.supply || 0

      allHoldings.push({
        mint,
        name: asset.content?.metadata?.name || defaultToken?.name || "Unknown",
        symbol: asset.content?.metadata?.symbol || defaultToken?.symbol || "???",
        decimals,
        balance: rawBalance,
        balanceFormatted,
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
        circulatingSupply > 0
          ? (token.totalBalance / circulatingSupply) * 100
          : null
      token.othersPercentExcludingBondingCurve =
        circulatingSupply > 0 ? (othersBalance / circulatingSupply) * 100 : null
    })
  )

  const aggregated = Array.from(aggregatedMap.values()).sort((a, b) => {
    const valueA = a.totalValueUsd || 0
    const valueB = b.totalValueUsd || 0
    return valueB - valueA
  })
  const selectedAggregatedHolding =
    tokenMint && requestedTokenIsTracked
      ? aggregated.find((token) => token.mint === tokenMint) || null
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

      const usdcHolding = holdings.find(
        (holding) => holding.mint === SOLANA_USDC_MINT
      )
      const selectedHoldingFull =
        tokenMint && requestedTokenIsTracked
          ? allHoldings.find(
              (holding) =>
                holding.walletAddress === wallet.address && holding.mint === tokenMint
            ) || null
          : null
      const selectedHolding =
        tokenMint && requestedTokenIsTracked
          ? holdings.find((holding) => holding.mint === tokenMint) || null
          : null
      const solUsdValue = (solBalance?.sol || 0) * solPriceUsd
      const trackedValueUsd = holdings.reduce(
        (sum, holding) => sum + (holding.valueUsd || 0),
        0
      )

      return {
        walletId: wallet.id,
        walletAddress: wallet.address,
        walletLabel: wallet.label,
        walletType: wallet.type,
        tradeStatus: wallet.trade_status,
        fundingCex: wallet.funding_cex,
        platform: wallet.platform,
        plannedDate: wallet.planned_date,
        solBalance: solBalance?.sol ?? null,
        solLamports: solBalance?.lamports ?? null,
        solUsdValue,
        usdcBalance: usdcHolding ? usdcHolding.balance / Math.pow(10, 6) : 0,
        usdcUsdValue: usdcHolding?.valueUsd || 0,
        trackedValueUsd,
        totalWalletValueUsd: solUsdValue + trackedValueUsd,
        selectedTokenMint: selectedAggregatedHolding?.mint || null,
        selectedTokenSymbol:
          selectedAggregatedHolding?.symbol || selectedTrackedToken?.symbol || null,
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
    ? selectedAggregatedHolding.totalBalance / Math.pow(10, selectedAggregatedHolding.decimals)
    : 0
  const totalSelectedTokenSupplyPercent =
    selectedAggregatedHolding?.holdingsPercent ?? null
  const portfolioTotalValueUsd = walletSummaries.reduce(
    (sum, wallet) => sum + wallet.totalWalletValueUsd,
    0
  )

  return {
    holdings: allHoldings,
    aggregated,
    walletSummaries,
    totalValueUsd: portfolioTotalValueUsd,
    walletCount: wallets.length,
    trackedTokenCount: effectiveTrackedTokens.length,
    totalSolBalance,
    totalUsdcBalance,
    totalSelectedTokenBalance,
    totalSelectedTokenSupplyPercent,
    selectedTokenMint: selectedAggregatedHolding?.mint || selectedTrackedToken?.mint || null,
    selectedTokenSymbol:
      selectedAggregatedHolding?.symbol || selectedTrackedToken?.symbol || null,
  }
}
