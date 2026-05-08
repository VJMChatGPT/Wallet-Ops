import { createClient } from "@/lib/supabase/server"
import { getLiveHoldingsData } from "@/lib/holdings"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const walletType = searchParams.get("type")
    const tokenMint = searchParams.get("token")
    const supabase = await createClient()

    const data = await getLiveHoldingsData(supabase, {
      walletType,
      tokenMint,
    })

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load holdings",
      },
      { status: 500 }
    )
  }
}
