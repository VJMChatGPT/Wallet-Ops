import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getNextSheetSortOrder, getSheetById } from "@/lib/sheets"

export async function POST(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const sourceSheet = await getSheetById(supabase, id)

    if (!sourceSheet) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }

    if (sourceSheet.type === "master") {
      return NextResponse.json(
        { error: "Master sheet cannot be duplicated" },
        { status: 400 }
      )
    }

    const [nextSortOrder, { data: sourceRows, error: rowsError }] = await Promise.all([
      getNextSheetSortOrder(supabase),
      supabase
        .from("sheet_wallets")
        .select("*")
        .eq("sheet_id", sourceSheet.id)
        .order("row_order", { ascending: true }),
    ])

    if (rowsError) {
      return NextResponse.json({ error: rowsError.message }, { status: 500 })
    }

    const { data: duplicate, error: duplicateError } = await supabase
      .from("sheets")
      .insert({
        name: `${sourceSheet.name} Copy`,
        type: "launch",
        token_mint: sourceSheet.token_mint,
        token_symbol: sourceSheet.token_symbol,
        sort_order: nextSortOrder,
      })
      .select("*")
      .single()

    if (duplicateError || !duplicate) {
      return NextResponse.json(
        { error: duplicateError?.message || "Failed to duplicate sheet" },
        { status: 500 }
      )
    }

    if ((sourceRows || []).length > 0) {
      const { error: insertError } = await supabase.from("sheet_wallets").insert(
        (sourceRows || []).map((row) => ({
          sheet_id: duplicate.id,
          wallet_id: row.wallet_id,
          row_order: row.row_order,
          label: row.label,
          trade_status: row.trade_status,
          funding_source_label: row.funding_source_label,
          funding_source_address: row.funding_source_address,
          funding_label_source: row.funding_label_source,
          first_funder_address: row.first_funder_address,
          platform: row.platform,
          funded_at: row.funded_at,
          funding_detection_method: row.funding_detection_method,
          funding_detected_at: row.funding_detected_at,
        }))
      )

      if (insertError) {
        await supabase.from("sheets").delete().eq("id", duplicate.id)
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ sheet: duplicate }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to duplicate sheet",
      },
      { status: 500 }
    )
  }
}
