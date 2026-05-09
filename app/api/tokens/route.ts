import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getTokenFromDexScreener, getBestPair } from "@/lib/api"
import {
  isBuiltInTrackedMint,
  JUPITER_LEND_USDC_MINT,
  mergeTrackedTokensWithDefaults,
  SOLANA_USDC_MINT,
} from "@/lib/default-tokens"

export const dynamic = "force-dynamic"

function errorResponse(error: unknown, fallback: string, status = 500) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status }
  )
}

// GET all tracked tokens
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: tokens, error } = await supabase
      .from("tracked_tokens")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      tokens: mergeTrackedTokensWithDefaults(tokens || []),
    })
  } catch (error) {
    return errorResponse(error, "Failed to load tokens")
  }
}

// POST - Add a new tracked token
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const body = await request.json()
    const { mint } = body

    if (!mint) {
      return NextResponse.json({ error: "Mint address is required" }, { status: 400 })
    }

    // Validate Solana mint address format
    const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    if (!solanaAddressRegex.test(mint.trim())) {
      return NextResponse.json({ error: "Invalid Solana mint address" }, { status: 400 })
    }

    const cleanMint = mint.trim()

    if (isBuiltInTrackedMint(cleanMint)) {
      return NextResponse.json(
        {
          error:
            cleanMint === SOLANA_USDC_MINT
              ? "USDC is already tracked by default"
              : "jlUSDC is already tracked by default",
        },
        { status: 409 }
      )
    }

    // Check if token already exists
    const { data: existing } = await supabase
      .from("tracked_tokens")
      .select("id")
      .eq("mint", cleanMint)
      .single()

    if (existing) {
      return NextResponse.json({ error: "Token is already being tracked" }, { status: 409 })
    }

    // Fetch token info from DexScreener to get name/symbol
    const dexData = await getTokenFromDexScreener(cleanMint)
    const bestPair = getBestPair(dexData?.pairs || null)

    let name = "Unknown Token"
    let symbol = "???"
    let decimals = 9

    if (bestPair) {
      name = bestPair.baseToken.name || name
      symbol = bestPair.baseToken.symbol || symbol
    }

    // Insert the token
    const { data: newToken, error } = await supabase
      .from("tracked_tokens")
      .insert({
        mint: cleanMint,
        name,
        symbol,
        decimals,
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ token: newToken }, { status: 201 })
  } catch (error) {
    return errorResponse(error, "Failed to add token")
  }
}

// DELETE - Remove a tracked token
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()

    const { searchParams } = new URL(request.url)
    const mint = searchParams.get("mint")

    if (!mint) {
      return NextResponse.json({ error: "Mint address is required" }, { status: 400 })
    }

    if (isBuiltInTrackedMint(mint)) {
      return NextResponse.json(
        {
          error:
            mint === JUPITER_LEND_USDC_MINT
              ? "jlUSDC is a built-in token and cannot be removed"
              : "USDC is a built-in token and cannot be removed",
        },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("tracked_tokens")
      .delete()
      .eq("mint", mint)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return errorResponse(error, "Failed to delete token")
  }
}
