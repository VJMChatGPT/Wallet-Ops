import type { TrackedToken } from "./types"

export const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
export const JUPITER_LEND_USDC_MINT = "9BEcn9aPEmhSPbPQeFGjidRiEKki46fVQDyPpSQXPA2D"
export const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112"

const DEFAULT_TRACKED_TOKENS: TrackedToken[] = [
  {
    id: "default-usdc",
    mint: SOLANA_USDC_MINT,
    name: "USD Coin",
    symbol: "USDC",
    decimals: 6,
    created_at: "",
    isDefault: true,
  },
  {
    id: "default-jlusdc",
    mint: JUPITER_LEND_USDC_MINT,
    name: "Jupiter Lend USDC",
    symbol: "jlUSDC",
    decimals: 6,
    created_at: "",
    isDefault: true,
  },
]

export function isBuiltInTrackedMint(mint: string) {
  return mint === SOLANA_USDC_MINT || mint === JUPITER_LEND_USDC_MINT
}

export function getDefaultTrackedTokens() {
  return DEFAULT_TRACKED_TOKENS.map((token) => ({ ...token }))
}

export function mergeTrackedTokensWithDefaults(tokens: TrackedToken[] = []) {
  const merged = new Map<string, TrackedToken>()

  for (const token of tokens) {
    merged.set(token.mint, {
      ...token,
      isDefault: isBuiltInTrackedMint(token.mint) || token.isDefault === true,
    })
  }

  for (const token of getDefaultTrackedTokens()) {
    const existing = merged.get(token.mint)
    merged.set(token.mint, existing ? { ...existing, isDefault: true } : token)
  }

  return Array.from(merged.values())
}
