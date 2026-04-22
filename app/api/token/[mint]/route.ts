import { NextResponse } from "next/server"
import { getTokenFromDexScreener, getBestPair } from "@/lib/api"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mint: string }> }
) {
  const { mint } = await params

  if (!mint) {
    return NextResponse.json(
      { error: "Token mint address is required" },
      { status: 400 }
    )
  }

  const dexData = await getTokenFromDexScreener(mint)

  if (!dexData || !dexData.pairs || dexData.pairs.length === 0) {
    return NextResponse.json(
      { error: "Token not found on DexScreener" },
      { status: 404 }
    )
  }

  const bestPair = getBestPair(dexData.pairs)

  return NextResponse.json({
    mint,
    pair: bestPair,
    allPairs: dexData.pairs,
  })
}
