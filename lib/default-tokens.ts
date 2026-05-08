import type { TrackedToken } from "./types"

export const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
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
]

export function getDefaultTrackedTokens() {
  return DEFAULT_TRACKED_TOKENS.map((token) => ({ ...token }))
}

export function mergeTrackedTokensWithDefaults(tokens: TrackedToken[] = []) {
  const merged = new Map<string, TrackedToken>()

  for (const token of tokens) {
    merged.set(token.mint, {
      ...token,
      isDefault: token.mint === SOLANA_USDC_MINT || token.isDefault === true,
    })
  }

  for (const token of getDefaultTrackedTokens()) {
    const existing = merged.get(token.mint)
    merged.set(token.mint, existing ? { ...existing, isDefault: true } : token)
  }

  return Array.from(merged.values())
}
