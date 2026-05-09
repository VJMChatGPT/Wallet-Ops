import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { detectAndPersistWalletFunding } from "@/lib/funding-detection"
import { getOrCreateMasterSheet } from "@/lib/sheets"
import type { TrackedWallet } from "@/lib/types"

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("tracked_wallets")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 })
    }

    const wallet = await detectAndPersistWalletFunding(
      supabase,
      data as TrackedWallet,
      { force: true }
    )

    const masterSheet = await getOrCreateMasterSheet(supabase)
    const { error: masterUpdateError } = await supabase
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

    if (masterUpdateError) {
      return NextResponse.json({ error: masterUpdateError.message }, { status: 500 })
    }

    return NextResponse.json({ wallet })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to refresh funding metadata",
      },
      { status: 500 }
    )
  }
}
