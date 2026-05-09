import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSheetById } from "@/lib/sheets"

function normalizeWalletIds(value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("walletIds must be a non-empty array")
  }

  const walletIds = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)

  if (walletIds.length === 0) {
    throw new Error("walletIds must contain valid ids")
  }

  if (new Set(walletIds).size !== walletIds.length) {
    throw new Error("walletIds cannot contain duplicates")
  }

  return walletIds
}

export async function PATCH(
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

    const body = await request.json().catch(() => ({}))
    const walletIds = normalizeWalletIds(body.walletIds)

    const { data: existingRows, error: existingError } = await supabase
      .from("sheet_wallets")
      .select("wallet_id")
      .eq("sheet_id", id)

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    const existingWalletIds = (existingRows || []).map((row) => row.wallet_id)
    if (existingWalletIds.length !== walletIds.length) {
      return NextResponse.json(
        { error: "walletIds must include every wallet in the current sheet" },
        { status: 400 }
      )
    }

    const existingWalletIdSet = new Set(existingWalletIds)
    const containsUnknownWallet = walletIds.some((walletId) => !existingWalletIdSet.has(walletId))

    if (containsUnknownWallet) {
      return NextResponse.json(
        { error: "walletIds contain wallets that do not belong to this sheet" },
        { status: 400 }
      )
    }

    const { error: updateError } = await supabase.from("sheet_wallets").upsert(
      walletIds.map((walletId, index) => ({
        sheet_id: id,
        wallet_id: walletId,
        row_order: index,
      })),
      {
        onConflict: "sheet_id,wallet_id",
      }
    )

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      walletIds,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to reorder sheet wallets",
      },
      { status: 500 }
    )
  }
}
