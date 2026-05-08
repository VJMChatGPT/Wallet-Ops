import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getLiveHoldingsData } from "@/lib/holdings"

export const dynamic = "force-dynamic"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const tokenMint = searchParams.get("token")
    const data = await getLiveHoldingsData(supabase, {
      sheetId: id,
      tokenMint,
    })

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load sheet holdings",
      },
      { status: 500 }
    )
  }
}
