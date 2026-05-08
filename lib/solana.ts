import { PublicKey } from "@solana/web3.js"

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export interface SolanaWalletValidationResult {
  isValid: boolean
  normalizedAddress: string | null
  error?: string
}

export function validateSolanaWalletAddress(
  input: string
): SolanaWalletValidationResult {
  const address = input.trim()

  if (!address) {
    return {
      isValid: false,
      normalizedAddress: null,
      error: "Wallet address is required",
    }
  }

  if (address.startsWith("0x")) {
    return {
      isValid: false,
      normalizedAddress: null,
      error: "This looks like an EVM address, not a Solana wallet",
    }
  }

  if (/\s/.test(address)) {
    return {
      isValid: false,
      normalizedAddress: null,
      error: "Address contains spaces",
    }
  }

  if (!SOLANA_ADDRESS_REGEX.test(address)) {
    return {
      isValid: false,
      normalizedAddress: null,
      error: "Invalid Solana address format",
    }
  }

  try {
    const publicKey = new PublicKey(address)

    if (!PublicKey.isOnCurve(publicKey.toBytes())) {
      return {
        isValid: false,
        normalizedAddress: null,
        error: "Address is not a real Solana wallet",
      }
    }

    return {
      isValid: true,
      normalizedAddress: publicKey.toBase58(),
    }
  } catch {
    return {
      isValid: false,
      normalizedAddress: null,
      error: "Invalid Solana wallet address",
    }
  }
}
