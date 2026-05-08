import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  buildSheetWalletInsert,
  getMasterSheetWalletSourceMap,
  getNextSheetSortOrder,
  listSheets,
  normalizeSheetPayload,
} from "@/lib/sheets"
import { mergeTrackedTokensWithDefaults } from "@/lib/default-tokens"
import type { TrackedToken } from "@/lib/types"

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

async function resolveTokenMetadata(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tokenMint: string | null,
  tokenSymbol: string | null
) {
  if (!tokenMint) {
    return { tokenMint: null, tokenSymbol: null }
  }

  if (tokenSymbol) {
    return { tokenMint, tokenSymbol }
  }

  const { data, error } = await supabase.from("tracked_tokens").select("*")
  if (error) {
    throw new Error(error.message)
  }

  const mergedTokens = mergeTrackedTokensWithDefaults((data || []) as TrackedToken[])
  const token = mergedTokens.find((entry) => entry.mint === tokenMint)

  return {
    tokenMint,
    tokenSymbol: token?.symbol || null,
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const sheets = await listSheets(supabase)
    return NextResponse.json({ sheets })
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to load sheets") },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))
    const payload = normalizeSheetPayload(body)
    const selectedWalletIds = Array.isArray(body.walletIds)
      ? body.walletIds.filter((value: unknown): value is string => typeof value === "string")
      : []
    const nextSortOrder = await getNextSheetSortOrder(supabase)
    const { tokenMint, tokenSymbol } = await resolveTokenMetadata(
      supabase,
      payload.token_mint,
      payload.token_symbol
    )

    const { data: sheet, error: sheetError } = await supabase
      .from("sheets")
      .insert({
        name: payload.name,
        type: "launch",
        token_mint: tokenMint,
        token_symbol: tokenSymbol,
        sort_order: nextSortOrder,
      })
      .select("*")
      .single()

    if (sheetError || !sheet) {
      return NextResponse.json(
        { error: sheetError?.message || "Failed to create sheet" },
        { status: 500 }
      )
    }

    if (selectedWalletIds.length > 0) {
      const { rowsByWalletId } = await getMasterSheetWalletSourceMap(supabase)
      const rowsToInsert = selectedWalletIds
        .map((walletId: string, index: number) => {
          const row = rowsByWalletId.get(walletId)
          return row ? buildSheetWalletInsert(row, sheet.id, index) : null
        })
        .filter(
          (
            row: ReturnType<typeof buildSheetWalletInsert> | null
          ): row is ReturnType<typeof buildSheetWalletInsert> => Boolean(row)
        )

      if (rowsToInsert.length > 0) {
        const { error: rowsError } = await supabase.from("sheet_wallets").insert(rowsToInsert)
        if (rowsError) {
          await supabase.from("sheets").delete().eq("id", sheet.id)
          return NextResponse.json({ error: rowsError.message }, { status: 500 })
        }
      }
    }

    return NextResponse.json({ sheet }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to create sheet") },
      { status: 500 }
    )
  }
}
