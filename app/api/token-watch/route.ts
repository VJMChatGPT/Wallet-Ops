import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBestPair, getTokenFromDexScreener } from "@/lib/api"
import { getPumpFunBondingCurveBalance } from "@/lib/pumpfun"
import type { TokenWatchAlert } from "@/lib/types"

const HELIUS_API_KEY = process.env.HELIUS_API_KEY
const HELIUS_ENHANCED_BASE_URL = "https://api-mainnet.helius-rpc.com/v0/addresses"

interface HeliusEnhancedTransaction {
  signature: string
  timestamp?: number
  source?: string
  description?: string
  tokenTransfers?: {
    mint?: string
    tokenAmount?: number
    fromUserAccount?: string
    toUserAccount?: string
  }[]
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mint = searchParams.get("mint")?.trim()
  const since = searchParams.get("since")

  if (!mint) {
    return NextResponse.json({ error: "Token mint is required" }, { status: 400 })
  }

  if (!HELIUS_API_KEY) {
    return NextResponse.json(
      { error: "HELIUS_API_KEY is not configured" },
      { status: 500 }
    )
  }

  const supabase = await createClient()
  const { data: trackedWallets, error } = await supabase
    .from("tracked_wallets")
    .select("address")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const ownedWallets = new Set((trackedWallets || []).map((wallet) => wallet.address))

  const [bondingCurve, dexData] = await Promise.all([
    getPumpFunBondingCurveBalance(mint),
    getTokenFromDexScreener(mint),
  ])

  const bestPair = getBestPair(dexData?.pairs || null)
  const watchAddresses = unique(
    [
      bondingCurve?.bondingCurveAddress,
      bondingCurve?.tokenAccountAddress,
      bestPair?.pairAddress,
    ].filter((address): address is string => Boolean(address))
  )

  if (watchAddresses.length === 0) {
    return NextResponse.json({
      alerts: [],
      watchAddresses: [],
    })
  }

  const gteTime = since ? Number(since) : null
  const alertMap = new Map<string, TokenWatchAlert>()

  await Promise.all(
    watchAddresses.map(async (watchAddress) => {
      try {
        const url = new URL(
          `${HELIUS_ENHANCED_BASE_URL}/${watchAddress}/transactions`
        )
        url.searchParams.set("api-key", HELIUS_API_KEY)
        url.searchParams.set("type", "SWAP")
        url.searchParams.set("sort-order", "desc")
        url.searchParams.set("limit", "25")

        if (gteTime && Number.isFinite(gteTime)) {
          url.searchParams.set("gte-time", String(gteTime))
        }

        const response = await fetch(url.toString(), {
          next: { revalidate: 0 },
        })

        if (!response.ok) {
          return
        }

        const transactions: HeliusEnhancedTransaction[] = await response.json()

        for (const transaction of transactions || []) {
          for (const transfer of transaction.tokenTransfers || []) {
            if (transfer.mint !== mint || !transfer.toUserAccount) {
              continue
            }

            if (ownedWallets.has(transfer.toUserAccount)) {
              continue
            }

            if (watchAddresses.includes(transfer.toUserAccount)) {
              continue
            }

            const alertKey = `${transaction.signature}:${transfer.toUserAccount}`
            if (alertMap.has(alertKey)) {
              continue
            }

            alertMap.set(alertKey, {
              signature: transaction.signature,
              buyerAddress: transfer.toUserAccount,
              amount:
                typeof transfer.tokenAmount === "number"
                  ? transfer.tokenAmount
                  : null,
              timestamp: transaction.timestamp || 0,
              source: transaction.source || null,
              marketAddress: watchAddress,
              description:
                transaction.description ||
                "External wallet bought the selected token",
            })
          }
        }
      } catch (fetchError) {
        console.error("Error checking token watch activity:", fetchError)
      }
    })
  )

  const alerts = Array.from(alertMap.values()).sort(
    (a, b) => b.timestamp - a.timestamp
  )

  return NextResponse.json({
    alerts,
    watchAddresses,
  })
}
