import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import {
  getWalletTokenBalances,
  getTokensFromDexScreener,
  getBestPair,
  formatTokenBalance,
  getWalletSolBalance,
  getAssetMint,
} from "@/lib/api"
import { getPumpFunBondingCurveBalance } from "@/lib/pumpfun"
import type {
  TokenHolding,
  AggregatedTokenHolding,
  WalletHoldingSummary,
} from "@/lib/types"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const walletType = searchParams.get("type") // 'mine', 'external', or null for all
  const tokenMint = searchParams.get("token") // Filter by specific token mint

  const supabase = await createClient()

  // Fetch tracked wallets and tokens. Only tokens explicitly saved in
  // tracked_tokens are allowed to appear in holdings.
  let query = supabase.from("tracked_wallets").select("*")
  if (walletType) {
    query = query.eq("type", walletType)
  }

  const [
    { data: wallets, error: walletsError },
    { data: trackedTokens, error: tokensError },
  ] = await Promise.all([
    query,
    supabase.from("tracked_tokens").select("*"),
  ])

  if (walletsError) {
    return NextResponse.json({ error: walletsError.message }, { status: 500 })
  }

  if (tokensError) {
    return NextResponse.json({ error: tokensError.message }, { status: 500 })
  }

  const trackedTokenMints = new Set((trackedTokens || []).map((token) => token.mint))
  const requestedTokenIsTracked = tokenMint ? trackedTokenMints.has(tokenMint) : true
  const allowedMints = tokenMint && requestedTokenIsTracked
    ? new Set([tokenMint])
    : trackedTokenMints

  if (!trackedTokens || trackedTokens.length === 0 || !requestedTokenIsTracked) {
    return NextResponse.json({
      holdings: [],
      aggregated: [],
      walletSummaries: [],
      totalValueUsd: 0,
      walletCount: wallets?.length || 0,
      trackedTokenCount: trackedTokens?.length || 0,
    })
  }

  if (!wallets || wallets.length === 0) {
    return NextResponse.json({
      holdings: [],
      aggregated: [],
      walletSummaries: [],
      totalValueUsd: 0,
      walletCount: 0,
      trackedTokenCount: trackedTokens.length,
    })
  }

  const allHoldings: TokenHolding[] = []

  // Fetch balances for all wallets in parallel
  const walletBalances = await Promise.all(
    wallets.map(async (wallet) => {
      const [assets, solBalance] = await Promise.all([
        getWalletTokenBalances(wallet.address),
        getWalletSolBalance(wallet.address),
      ])
      return { wallet, assets, solBalance }
    })
  )

  // Fetch DexScreener data only for tokens that are explicitly tracked.
  const dexData = await getTokensFromDexScreener(Array.from(allowedMints))

  // Build holdings (optionally filtered by token mint)
  for (const { wallet, assets } of walletBalances) {
    for (const asset of assets) {
      const mint = getAssetMint(asset)

      // Skip every wallet asset that is not in tracked_tokens.
      if (!allowedMints.has(mint)) {
        continue
      }
      
      const pairs = dexData.get(mint)
      const bestPair = getBestPair(pairs || null)
      const decimals = asset.token_info?.decimals || 9
      // Use the actual wallet balance, NOT the total supply
      // token_info.balance = wallet's token balance (raw)
      // token_info.supply = total supply of the token (used for market cap/percentage calculations only)
      const rawBalance = asset.token_info?.balance || 0
      const balanceFormatted = formatTokenBalance(rawBalance, decimals)
      const priceUsd = bestPair ? parseFloat(bestPair.priceUsd) : null
      const actualBalance = rawBalance / Math.pow(10, decimals)
      const valueUsd = priceUsd !== null ? actualBalance * priceUsd : null
      const totalSupply = asset.token_info?.supply || 0

      allHoldings.push({
        mint,
        name: asset.content?.metadata?.name || "Unknown",
        symbol: asset.content?.metadata?.symbol || "???",
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

  // Aggregate holdings by token
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
        existing.totalValueUsd =
          (existing.totalValueUsd || 0) + holding.valueUsd
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
        holdingsPercent: null, // Will be calculated below
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

  // Calculate holdings percentage for each aggregated token
  await Promise.all(
    Array.from(aggregatedMap.values()).map(async (token) => {
    if (token.totalSupply > 0) {
      token.holdingsPercent = (token.totalBalance / token.totalSupply) * 100
    }

      const bondingCurve = await getPumpFunBondingCurveBalance(token.mint)
      const bondingCurveBalance = bondingCurve?.balance || 0
      const circulatingSupply = Math.max(
        token.totalSupply - bondingCurveBalance,
        0
      )
      const othersBalance = Math.max(
        circulatingSupply - token.totalBalance,
        0
      )

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
        circulatingSupply > 0
          ? (othersBalance / circulatingSupply) * 100
          : null
    })
  )

  const aggregated = Array.from(aggregatedMap.values()).sort((a, b) => {
    // Sort by total value descending
    const valueA = a.totalValueUsd || 0
    const valueB = b.totalValueUsd || 0
    return valueB - valueA
  })

  const totalValueUsd = aggregated.reduce(
    (sum, token) => sum + (token.totalValueUsd || 0),
    0
  )

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

      return {
        walletAddress: wallet.address,
        walletLabel: wallet.label,
        walletType: wallet.type,
        solBalance: solBalance?.sol ?? null,
        solLamports: solBalance?.lamports ?? null,
        trackedValueUsd: holdings.reduce(
          (sum, holding) => sum + (holding.valueUsd || 0),
          0
        ),
        holdings,
      }
    }
  )

  return NextResponse.json({
    holdings: allHoldings,
    aggregated,
    walletSummaries,
    totalValueUsd,
    walletCount: wallets.length,
    trackedTokenCount: trackedTokens.length,
  })
}
