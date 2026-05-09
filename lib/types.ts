// Database types
export interface TrackedWallet {
  id: string
  address: string
  label: string | null
  type: "mine" | "external"
  sort_order: number | null
  trade_status: string | null
  funding_source_label: string | null
  funding_source_address: string | null
  funding_label_source: string | null
  first_funder_address: string | null
  platform: string | null
  funded_at: string | null
  funding_detection_method: string | null
  funding_detected_at: string | null
  created_at: string
}

export interface WorkbookSheet {
  id: string
  name: string
  type: "master" | "launch"
  token_mint: string | null
  token_symbol: string | null
  sort_order: number
  archived_at: string | null
  created_at: string
  updated_at: string
}

export interface SheetWallet {
  id: string
  sheet_id: string
  wallet_id: string
  row_order: number
  label: string | null
  trade_status: string | null
  funding_source_label: string | null
  funding_source_address: string | null
  funding_label_source: string | null
  first_funder_address: string | null
  platform: string | null
  funded_at: string | null
  funding_detection_method: string | null
  funding_detected_at: string | null
  created_at: string
}

export interface WorkbookSheetWithWalletCount extends WorkbookSheet {
  wallet_count: number
}

export interface TrackedToken {
  id: string
  mint: string
  name: string
  symbol: string
  decimals: number
  created_at: string
  isDefault?: boolean
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
  sheetId: string
  sheetType: "master" | "launch"
  walletId: string | null
  walletAddress: string
  walletLabel: string | null
  walletType: "mine" | "external"
  sortOrder: number | null
  tradeStatus: string | null
  fundingSourceLabel: string | null
  fundingSourceAddress: string | null
  fundingLabelSource: string | null
  firstFunderAddress: string | null
  platform: string | null
  fundedAt: string | null
  fundingDetectionMethod: string | null
  fundingDetectedAt: string | null
  solBalance: number | null
  solLamports: number | null
  solUsdValue: number
  usdcBalance: number
  jlUsdcBalance: number
  usdcUsdValue: number
  jlUsdcUsdValue: number
  totalDollarValueUsd: number
  trackedValueUsd: number
  totalWalletValueUsd: number
  selectedTokenMint: string | null
  selectedTokenSymbol: string | null
  selectedTokenBalance: number
  selectedTokenBalanceFormatted: string
  selectedTokenSupplyPercent: number | null
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

export interface TokenWatchAlert {
  signature: string
  buyerAddress: string
  amount: number | null
  timestamp: number
  source: string | null
  marketAddress: string
  description: string
}

export interface HoldingsResponseData {
  sheet: WorkbookSheet | null
  holdings: TokenHolding[]
  aggregated: AggregatedTokenHolding[]
  walletSummaries: WalletHoldingSummary[]
  totalValueUsd: number
  walletCount: number
  trackedTokenCount: number
  totalSolBalance: number
  totalUsdcBalance: number
  totalJlUsdcBalance: number
  totalDollarValueUsd: number
  totalSelectedTokenBalance: number
  totalSelectedTokenSupplyPercent: number | null
  selectedTokenMint: string | null
  selectedTokenSymbol: string | null
}

export interface PortfolioSnapshot {
  id: string
  name: string | null
  sheet_id: string | null
  sheet_name: string | null
  total_portfolio_usd: number | string
  wallet_count: number
  selected_token_mint: string | null
  selected_token_symbol: string | null
  total_sol_balance: number | string | null
  total_usdc_balance: number | string | null
  total_selected_token_balance: number | string | null
  total_selected_token_supply_percent: number | string | null
  created_at: string
}

export interface PortfolioSnapshotWallet {
  id: string
  snapshot_id: string
  wallet_id: string | null
  wallet_label: string | null
  wallet_address: string
  wallet_type: "mine" | "external" | null
  row_order: number | null
  trade_status: string | null
  funding_source_label: string | null
  funding_source_address: string | null
  funding_label_source: string | null
  first_funder_address: string | null
  platform: string | null
  funded_at: string | null
  sol_balance: number | string | null
  usdc_balance: number | string | null
  sol_usd_value: number | string | null
  tracked_tokens_usd_value: number | string | null
  total_wallet_usd_value: number | string | null
  selected_token_mint: string | null
  selected_token_symbol: string | null
  selected_token_balance: number | string | null
  selected_token_supply_percent: number | string | null
  token_breakdown: WalletHoldingSummary["holdings"] | null
  created_at: string
}

export interface PortfolioSnapshotDetail {
  snapshot: PortfolioSnapshot
  wallets: PortfolioSnapshotWallet[]
}

export interface SnapshotWalletComparisonRow {
  walletAddress: string
  walletLabel: string | null
  walletType: string | null
  startTokenAmount: number
  startTokenSupplyPercent: number | null
  endTokenAmount: number
  endTokenSupplyPercent: number | null
  deltaTokenAmount: number
  deltaTokenSupplyPercent: number | null
  startPresent: boolean
  endPresent: boolean
}

export interface SnapshotComparisonResponse {
  sheetId: string | null
  sheetName: string | null
  from: PortfolioSnapshot
  to: PortfolioSnapshot
  startSolBalance: number
  endSolBalance: number
  deltaSolBalance: number
  deltaSolPercent: number | null
  selectedTokenMint: string | null
  selectedTokenSymbol: string | null
  startTokenAmount: number
  endTokenAmount: number
  deltaTokenAmount: number
  startTokenSupplyPercent: number | null
  endTokenSupplyPercent: number | null
  deltaTokenSupplyPercent: number | null
  tokenMismatch: boolean
  wallets: SnapshotWalletComparisonRow[]
}
