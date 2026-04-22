import { getAssociatedTokenAddressSync } from "@solana/spl-token"
import { PublicKey } from "@solana/web3.js"

const HELIUS_API_KEY = process.env.HELIUS_API_KEY
const HELIUS_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
const PUMP_FUN_PROGRAM_ID = new PublicKey(
  "6EF8rrecthR5DkqLfoG6vqqG58c4cNE6YyN4mHJhY7J"
)

export interface PumpFunBondingCurveBalance {
  bondingCurveAddress: string
  tokenAccountAddress: string
  balance: number
  decimals: number
}

export async function getPumpFunBondingCurveBalance(
  mintAddress: string
): Promise<PumpFunBondingCurveBalance | null> {
  if (!HELIUS_API_KEY) {
    return null
  }

  try {
    const mint = new PublicKey(mintAddress)
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from("bonding-curve"), mint.toBuffer()],
      PUMP_FUN_PROGRAM_ID
    )
    const tokenAccount = getAssociatedTokenAddressSync(
      mint,
      bondingCurve,
      true
    )

    const response = await fetch(HELIUS_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "get-bonding-curve-balance",
        method: "getTokenAccountBalance",
        params: [tokenAccount.toBase58()],
      }),
    })

    const data = await response.json()
    if (data.error || !data.result?.value?.amount) {
      return null
    }

    return {
      bondingCurveAddress: bondingCurve.toBase58(),
      tokenAccountAddress: tokenAccount.toBase58(),
      balance: Number(data.result.value.amount),
      decimals: data.result.value.decimals,
    }
  } catch (error) {
    console.error("Error fetching Pump.fun bonding curve balance:", error)
    return null
  }
}
