import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSheetById } from "@/lib/sheets"
import {
  normalizeFundedAt,
  normalizeFundingSourceLabel,
  normalizePlatform,
  normalizeTradeStatus,
} from "@/lib/wallet-fields"

function normalizeLabel(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeRowOrder(value: unknown) {
  if (value === undefined) return undefined
  if (value === null || value === "") return null

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("row_order must be a non-negative integer")
  }

  return value
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; walletId: string }> }
) {
  try {
    const { id, walletId } = await params
    const supabase = await createClient()
    const sheet = await getSheetById(supabase, id)

    if (!sheet) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const updatePayload = {
      ...(body.label !== undefined ? { label: normalizeLabel(body.label) } : {}),
      ...(body.trade_status !== undefined
        ? { trade_status: normalizeTradeStatus(body.trade_status) }
        : {}),
      ...(body.funding_source_label !== undefined
        ? {
            funding_source_label: normalizeFundingSourceLabel(body.funding_source_label),
          }
        : {}),
      ...(body.platform !== undefined
        ? { platform: normalizePlatform(body.platform) }
        : {}),
      ...(body.funded_at !== undefined
        ? { funded_at: normalizeFundedAt(body.funded_at) }
        : {}),
      ...(body.row_order !== undefined
        ? { row_order: normalizeRowOrder(body.row_order) }
        : {}),
    }

    const { data, error } = await supabase
      .from("sheet_wallets")
      .update(updatePayload)
      .eq("sheet_id", id)
      .eq("wallet_id", walletId)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ row: data })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update sheet wallet row",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; walletId: string }> }
) {
  try {
    const { id, walletId } = await params
    const supabase = await createClient()
    const sheet = await getSheetById(supabase, id)

    if (!sheet) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }

    if (sheet.type === "master") {
      return NextResponse.json(
        { error: "Wallets cannot be removed from the master sheet" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("sheet_wallets")
      .delete()
      .eq("sheet_id", id)
      .eq("wallet_id", walletId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to remove wallet from sheet",
      },
      { status: 500 }
    )
  }
}
