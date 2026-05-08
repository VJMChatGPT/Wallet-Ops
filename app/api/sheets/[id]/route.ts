import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSheetById } from "@/lib/sheets"
import { mergeTrackedTokensWithDefaults } from "@/lib/default-tokens"
import type { TrackedToken } from "@/lib/types"

function normalizeName(value: unknown) {
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

async function resolveTokenSymbol(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tokenMint: string | null | undefined,
  tokenSymbol: string | null | undefined
) {
  if (tokenMint === undefined) {
    return undefined
  }

  if (!tokenMint) {
    return { token_mint: null, token_symbol: null }
  }

  if (tokenSymbol) {
    return { token_mint: tokenMint, token_symbol: tokenSymbol }
  }

  const { data, error } = await supabase.from("tracked_tokens").select("*")
  if (error) {
    throw new Error(error.message)
  }

  const mergedTokens = mergeTrackedTokensWithDefaults((data || []) as TrackedToken[])
  const token = mergedTokens.find((entry) => entry.mint === tokenMint)

  return {
    token_mint: tokenMint,
    token_symbol: token?.symbol || null,
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const existingSheet = await getSheetById(supabase, id)

    if (!existingSheet) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (body.name !== undefined) {
      const normalizedName = normalizeName(body.name)
      if (!normalizedName) {
        return NextResponse.json({ error: "Sheet name is required" }, { status: 400 })
      }
      updatePayload.name = normalizedName
    }

    if (body.token_mint !== undefined || body.token_symbol !== undefined) {
      const tokenFields = await resolveTokenSymbol(
        supabase,
        body.token_mint ?? null,
        body.token_symbol ?? null
      )
      Object.assign(updatePayload, tokenFields)
    }

    if (body.archived !== undefined) {
      if (existingSheet.type === "master") {
        return NextResponse.json(
          { error: "Master sheet cannot be archived" },
          { status: 400 }
        )
      }

      updatePayload.archived_at = body.archived ? new Date().toISOString() : null
    }

    const { data, error } = await supabase
      .from("sheets")
      .update(updatePayload)
      .eq("id", id)
      .select("*")
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ sheet: data })
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Failed to update sheet") },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _: Request,
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
        { error: "Master sheet cannot be archived" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("sheets")
      .update({
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      { error: errorMessage(error, "Failed to archive sheet") },
      { status: 500 }
    )
  }
}
