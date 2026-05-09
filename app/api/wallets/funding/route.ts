import { NextResponse } from "next/server"
import { detectAndPersistWalletFundingBatch } from "@/lib/funding-detection"
import { createClient } from "@/lib/supabase/server"
import { getOrCreateMasterSheet } from "@/lib/sheets"
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
    const refreshedWallets = await detectAndPersistWalletFundingBatch(
      supabase,
      wallets,
      { force: true }
    )
    const masterSheet = await getOrCreateMasterSheet(supabase)

    for (const wallet of refreshedWallets) {
      await supabase
        .from("sheet_wallets")
        .update({
          funding_source_label: wallet.funding_source_label,
          funding_source_address: wallet.funding_source_address,
          funding_label_source: wallet.funding_label_source,
          first_funder_address: wallet.first_funder_address,
          funded_at: wallet.funded_at,
          funding_detection_method: wallet.funding_detection_method,
          funding_detected_at: wallet.funding_detected_at,
        })
        .eq("sheet_id", masterSheet.id)
        .eq("wallet_id", wallet.id)
    }

    return NextResponse.json({
      refreshedWallets: refreshedWallets.length,
      wallets: refreshedWallets,
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
