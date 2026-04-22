// Database types
export interface TrackedWallet {
  id: string
  address: string
  label: string | null
  type: "mine" | "external"
  created_at: string
}

export interface TrackedToken {
  id: string
  mint: string
  name: string
  symbol: string
  decimals: number
  created_at: string
}

export interface TokenSnapshot {
  id: string
  mint: string
  market_cap: number | null
  price_usd: number | null
  total_supply_raw: string | null
  created_at: string
}

// Helius API types
export interface HeliusTokenBalance {
  mint: string
  amount: number
  decimals: number
  tokenAccount: string
}

export interface HeliusAsset {
  id: string
  interface: string
  content: {
    metadata: {
      name: string
      symbol: string
    }
  }
  token_info?: {
    mint?: string
    decimals: number
    balance: number // The actual wallet balance (raw, needs division by 10^decimals)
    supply: number // Total supply of the token
    price_info?: {
      price_per_token: number
      currency: string
    }
  }
}

// DexScreener API types
export interface DexScreenerPair {
  chainId: string
  dexId: string
  url: string
  pairAddress: string
  baseToken: {
    address: string
    name: string
    symbol: string
  }
  quoteToken: {
    address: string
    name: string
    symbol: string
  }
  priceNative: string
  priceUsd: string
  txns: {
    m5: { buys: number; sells: number }
    h1: { buys: number; sells: number }
    h6: { buys: number; sells: number }
    h24: { buys: number; sells: number }
  }
  volume: {
    h24: number
    h6: number
    h1: number
    m5: number
  }
  priceChange: {
    m5: number
    h1: number
    h6: number
    h24: number
  }
  liquidity?: {
    usd: number
    base: number
    quote: number
  }
  fdv?: number
  marketCap?: number
}

export interface DexScreenerResponse {
  schemaVersion: string
  pairs: DexScreenerPair[] | null
}

// Aggregated types for UI
export interface TokenHolding {
  mint: string
  name: string
  symbol: string
  decimals: number
  balance: number
  balanceFormatted: string
  priceUsd: number | null
  valueUsd: number | null
  marketCap: number | null
  priceChange24h: number | null
  volume24h: number | null
  liquidity: number | null
  walletAddress: string
  walletLabel: string | null
  totalSupply: number // Total supply of the token (for percentage calculations)
}

export interface WalletWithHoldings {
  wallet: TrackedWallet
  holdings: TokenHolding[]
  totalValueUsd: number
}

export interface AggregatedTokenHolding {
  mint: string
  name: string
  symbol: string
  decimals: number
  totalBalance: number
  totalBalanceFormatted: string
  priceUsd: number | null
  totalValueUsd: number | null
  marketCap: number | null
  priceChange24h: number | null
  volume24h: number | null
  liquidity: number | null
  totalSupply: number // Total supply of the token (for percentage calculations)
  holdingsPercent: number | null // Percentage of total supply held
  bondingCurveBalance: number | null
  bondingCurveBalanceFormatted: string | null
  bondingCurvePercent: number | null
  circulatingSupplyExcludingBondingCurve: number | null
  othersBalanceExcludingBondingCurve: number | null
  othersBalanceExcludingBondingCurveFormatted: string | null
  holdingsPercentExcludingBondingCurve: number | null
  othersPercentExcludingBondingCurve: number | null
  holdingsByWallet: {
    walletAddress: string
    walletLabel: string | null
    balance: number
    balanceFormatted: string
    valueUsd: number | null
  }[]
}

export interface WalletHoldingSummary {
  walletAddress: string
  walletLabel: string | null
  walletType: "mine" | "external"
  solBalance: number | null
  solLamports: number | null
  trackedValueUsd: number
  holdings: {
    mint: string
    symbol: string
    name: string
    balance: number
    balanceFormatted: string
    valueUsd: number | null
    holdingsPercent: number | null
  }[]
}
