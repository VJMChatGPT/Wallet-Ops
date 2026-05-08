import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { validateSolanaWalletAddress } from "@/lib/solana"
import {
  normalizeFundedAt,
  normalizeFundingSourceLabel,
  normalizePlatform,
  normalizeTradeStatus,
} from "@/lib/wallet-fields"
import { getOrCreateMasterSheet } from "@/lib/sheets"

function normalizeLabel(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeSortOrder(value: unknown) {
  if (value === undefined) return undefined
  if (value === null || value === "") return null

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("sort_order must be a non-negative integer")
  }

  return value
}

function buildWalletMetadata(input: {
  trade_status?: unknown
  funding_source_label?: unknown
  funding_cex?: unknown
  platform?: unknown
  funded_at?: unknown
  planned_date?: unknown
}) {
  return {
    trade_status:
      input.trade_status !== undefined ? normalizeTradeStatus(input.trade_status) : undefined,
    funding_source_label:
      input.funding_source_label !== undefined
        ? normalizeFundingSourceLabel(input.funding_source_label)
        : input.funding_cex !== undefined
          ? normalizeFundingSourceLabel(input.funding_cex)
          : undefined,
    platform: input.platform !== undefined ? normalizePlatform(input.platform) : undefined,
    funded_at:
      input.funded_at !== undefined
        ? normalizeFundedAt(input.funded_at)
        : input.planned_date !== undefined
          ? normalizeFundedAt(input.planned_date)
          : undefined,
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json()

    let normalizedAddress: string | undefined
    if (body.address !== undefined) {
      if (!body.address) {
        return NextResponse.json(
          { error: "Wallet address is required" },
          { status: 400 }
        )
      }

      const validation = validateSolanaWalletAddress(body.address)
      if (!validation.isValid || !validation.normalizedAddress) {
        return NextResponse.json(
          { error: validation.error || "Invalid Solana wallet address" },
          { status: 400 }
        )
      }

      normalizedAddress = validation.normalizedAddress
      const { data: existingWallet, error: existingWalletError } = await supabase
        .from("tracked_wallets")
        .select("id")
        .eq("address", normalizedAddress)
        .maybeSingle()

      if (existingWalletError) {
        return NextResponse.json({ error: existingWalletError.message }, { status: 500 })
      }

      if (existingWallet && existingWallet.id !== id) {
        return NextResponse.json({ error: "Wallet already exists" }, { status: 409 })
      }
    }

    const metadata = buildWalletMetadata(body)
    const updatePayload = {
      ...(normalizedAddress ? { address: normalizedAddress } : {}),
      ...(body.label !== undefined ? { label: normalizeLabel(body.label) } : {}),
      ...(body.sort_order !== undefined
        ? { sort_order: normalizeSortOrder(body.sort_order) }
        : {}),
      ...(metadata.trade_status !== undefined
        ? { trade_status: metadata.trade_status }
        : {}),
      ...(metadata.funding_source_label !== undefined
        ? { funding_source_label: metadata.funding_source_label }
        : {}),
      ...(metadata.platform !== undefined ? { platform: metadata.platform } : {}),
      ...(metadata.funded_at !== undefined
        ? { funded_at: metadata.funded_at }
        : {}),
    }

    const { data, error } = await supabase
      .from("tracked_wallets")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const masterSheet = await getOrCreateMasterSheet(supabase)
    const masterUpdatePayload = {
      ...(body.label !== undefined ? { label: normalizeLabel(body.label) } : {}),
      ...(body.sort_order !== undefined
        ? { row_order: normalizeSortOrder(body.sort_order) }
        : {}),
      ...(metadata.trade_status !== undefined
        ? { trade_status: metadata.trade_status }
        : {}),
      ...(metadata.funding_source_label !== undefined
        ? { funding_source_label: metadata.funding_source_label }
        : {}),
      ...(metadata.platform !== undefined ? { platform: metadata.platform } : {}),
      ...(metadata.funded_at !== undefined
        ? { funded_at: metadata.funded_at }
        : {}),
    }

    if (Object.keys(masterUpdatePayload).length > 0) {
      await supabase
        .from("sheet_wallets")
        .update(masterUpdatePayload)
        .eq("sheet_id", masterSheet.id)
        .eq("wallet_id", id)
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update wallet",
      },
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
    const { error } = await supabase.from("tracked_wallets").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete wallet",
      },
      { status: 500 }
    )
  }
}
