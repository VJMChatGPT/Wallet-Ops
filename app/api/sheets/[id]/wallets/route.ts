import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  buildSheetWalletInsert,
  getMasterSheetWalletSourceMap,
  getSheetById,
} from "@/lib/sheets"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const sheet = await getSheetById(supabase, id)

    if (!sheet) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }

    if (sheet.type === "master") {
      return NextResponse.json(
        { error: "Use wallet CRUD to add wallets to the master sheet" },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const walletIds = Array.isArray(body.walletIds)
      ? body.walletIds.filter((value: unknown): value is string => typeof value === "string")
      : []

    if (walletIds.length === 0) {
      return NextResponse.json(
        { error: "At least one wallet is required" },
        { status: 400 }
      )
    }

    const [
      { data: existingRows, error: existingRowsError },
      { rowsByWalletId },
    ] = await Promise.all([
      supabase.from("sheet_wallets").select("wallet_id").eq("sheet_id", sheet.id),
      getMasterSheetWalletSourceMap(supabase),
    ])

    if (existingRowsError) {
      return NextResponse.json({ error: existingRowsError.message }, { status: 500 })
    }

    const existingWalletIds = new Set(
      ((existingRows || []) as { wallet_id: string }[]).map((row) => row.wallet_id)
    )
    const rowsToInsert = (walletIds as string[])
      .filter((walletId: string) => !existingWalletIds.has(walletId))
      .map((walletId: string) => rowsByWalletId.get(walletId))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row, index: number) =>
        buildSheetWalletInsert(row, sheet.id, existingWalletIds.size + index)
      )

    if (rowsToInsert.length === 0) {
      return NextResponse.json({ insertedCount: 0 })
    }

    const { error } = await supabase.from("sheet_wallets").insert(rowsToInsert)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ insertedCount: rowsToInsert.length })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to add wallets to sheet",
      },
      { status: 500 }
    )
  }
}
