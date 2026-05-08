import type {
  HeliusAsset,
  DexScreenerResponse,
  TokenHolding,
  TrackedWallet,
} from "./types"

const HELIUS_API_KEY = process.env.HELIUS_API_KEY
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
const LAMPORTS_PER_SOL = 1_000_000_000
const DEFAULT_LOCALE = "en-US"

// Fetch token balances for a wallet using Helius DAS API
export async function getWalletTokenBalances(
  walletAddress: string
): Promise<HeliusAsset[]> {
  if (!HELIUS_API_KEY) {
    console.error("HELIUS_API_KEY not configured")
    return []
  }

  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "get-assets",
        method: "getAssetsByOwner",
        params: {
          ownerAddress: walletAddress,
          page: 1,
          limit: 1000,
          displayOptions: {
            showFungible: true,
            showNativeBalance: false,
          },
        },
      }),
    })

    const data = await response.json()
    if (data.error) {
      console.error("Helius API error:", data.error)
      return []
    }

    // Filter to only fungible tokens (SPL tokens)
    const assets = data.result?.items || []
    return assets.filter(
      (asset: HeliusAsset) =>
        asset.token_info && asset.token_info.decimals !== undefined
    )
  } catch (error) {
    console.error("Error fetching wallet balances:", error)
    return []
  }
}

// Fetch native SOL balance for a wallet.
export async function getWalletSolBalance(
  walletAddress: string
): Promise<{ lamports: number; sol: number } | null> {
  if (!HELIUS_API_KEY) {
    console.error("HELIUS_API_KEY not configured")
    return null
  }

  try {
    const response = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "get-balance",
        method: "getBalance",
        params: [walletAddress],
      }),
    })

    const data = await response.json()
    if (data.error) {
      console.error("Helius SOL balance error:", data.error)
      return null
    }

    const lamports = data.result?.value
    if (typeof lamports !== "number") {
      return null
    }

    return {
      lamports,
      sol: lamports / LAMPORTS_PER_SOL,
    }
  } catch (error) {
    console.error("Error fetching SOL balance:", error)
    return null
  }
}

export function getAssetMint(asset: HeliusAsset): string {
  return asset.token_info?.mint || asset.id
}

// Fetch token info from DexScreener
export async function getTokenFromDexScreener(
  mintAddress: string
): Promise<DexScreenerResponse | null> {
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${mintAddress}`,
      { next: { revalidate: 60 } }
    )

    if (!response.ok) {
      return null
    }

    return response.json()
  } catch (error) {
    console.error("Error fetching from DexScreener:", error)
    return null
  }
}

// Batch fetch token info from DexScreener (max 30 tokens per request)
export async function getTokensFromDexScreener(
  mintAddresses: string[]
): Promise<Map<string, DexScreenerResponse["pairs"]>> {
  const results = new Map<string, DexScreenerResponse["pairs"]>()

  // DexScreener allows comma-separated addresses (up to 30)
  const chunks: string[][] = []
  for (let i = 0; i < mintAddresses.length; i += 30) {
    chunks.push(mintAddresses.slice(i, i + 30))
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const response = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${chunk.join(",")}`,
          { next: { revalidate: 60 } }
        )

        if (response.ok) {
          const data: DexScreenerResponse = await response.json()
          if (data.pairs) {
            // Group pairs by base token address
            for (const pair of data.pairs) {
              const mint = pair.baseToken.address
              const existing = results.get(mint) || []
              existing.push(pair)
              results.set(mint, existing)
            }
          }
        }
      } catch (error) {
        console.error("Error fetching batch from DexScreener:", error)
      }
    })
  )

  return results
}

// Get the best pair for a token (highest liquidity)
export function getBestPair(
  pairs: DexScreenerResponse["pairs"]
): DexScreenerResponse["pairs"][0] | null {
  if (!pairs || pairs.length === 0) return null

  // Sort by liquidity (descending) and return the best one
  return pairs.sort((a, b) => {
    const liquidityA = a.liquidity?.usd || 0
    const liquidityB = b.liquidity?.usd || 0
    return liquidityB - liquidityA
  })[0]
}

// Format token balance with proper decimals
export function formatTokenBalance(
  amount: number,
  decimals: number
): string {
  const formatted = amount / Math.pow(10, decimals)
  if (formatted >= 1_000_000_000) {
    return `${(formatted / 1_000_000_000).toFixed(2)}B`
  }
  if (formatted >= 1_000_000) {
    return `${(formatted / 1_000_000).toFixed(2)}M`
  }
  if (formatted >= 1_000) {
    return `${(formatted / 1_000).toFixed(2)}K`
  }
  if (formatted >= 1) {
    return formatted.toFixed(2)
  }
  return formatted.toPrecision(4)
}

// Format USD value
export function formatUsd(value: number | null): string {
  if (value === null || value === undefined) return "-"
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`
  }
  if (value >= 1) {
    return `$${value.toFixed(2)}`
  }
  if (value >= 0.01) {
    return `$${value.toFixed(4)}`
  }
  return `$${value.toPrecision(4)}`
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(DEFAULT_LOCALE, options).format(value)
}

// Format percentage
export function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return "-"
  const sign = value >= 0 ? "+" : ""
  return `${sign}${value.toFixed(2)}%`
}

// Aggregate holdings across wallets
export async function getAggregatedHoldings(
  wallets: TrackedWallet[]
): Promise<TokenHolding[]> {
  const allHoldings: TokenHolding[] = []
  const mintAddresses = new Set<string>()

  // Fetch balances for all wallets
  const walletBalances = await Promise.all(
    wallets.map(async (wallet) => {
      const assets = await getWalletTokenBalances(wallet.address)
      return { wallet, assets }
    })
  )

  // Collect all mint addresses
  for (const { assets } of walletBalances) {
    for (const asset of assets) {
      mintAddresses.add(asset.id)
    }
  }

  // Fetch DexScreener data for all tokens
  const dexData = await getTokensFromDexScreener(Array.from(mintAddresses))

  // Build holdings
  for (const { wallet, assets } of walletBalances) {
    for (const asset of assets) {
      const pairs = dexData.get(asset.id)
      const bestPair = getBestPair(pairs || null)
      const decimals = asset.token_info?.decimals || 9
      // Use the actual wallet balance, NOT the total supply
      const balance = asset.token_info?.balance || 0
      const totalSupply = asset.token_info?.supply || 0
      const balanceFormatted = formatTokenBalance(balance, decimals)
      const priceUsd = bestPair ? parseFloat(bestPair.priceUsd) : null
      const valueUsd =
        priceUsd !== null ? (balance / Math.pow(10, decimals)) * priceUsd : null

      allHoldings.push({
        mint: asset.id,
        name: asset.content?.metadata?.name || "Unknown",
        symbol: asset.content?.metadata?.symbol || "???",
        decimals,
        balance,
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

  return allHoldings
}
