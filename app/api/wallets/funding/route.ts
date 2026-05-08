import { NextResponse } from "next/server"
import { enrichWalletFundingMetadata } from "@/lib/funding-detection"
import { createClient } from "@/lib/supabase/server"
import type { TrackedWallet } from "@/lib/types"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const walletId =
      typeof body.walletId === "string" && body.walletId.trim()
        ? body.walletId.trim()
        : null

    const supabase = await createClient()
    let query = supabase.from("tracked_wallets").select("*")

    if (walletId) {
      query = query.eq("id", walletId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const wallets = (data || []) as TrackedWallet[]
    const hydratedWallets = await enrichWalletFundingMetadata(supabase, wallets)

    return NextResponse.json({
      refreshedWallets: hydratedWallets.length,
      wallets: hydratedWallets,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to refresh funding metadata",
      },
      { status: 500 }
    )
  }
}
