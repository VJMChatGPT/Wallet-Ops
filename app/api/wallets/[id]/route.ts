import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { validateSolanaWalletAddress } from "@/lib/solana"
import {
  normalizeFundingCex,
  normalizePlatform,
  normalizePlannedDate,
  normalizeTradeStatus,
} from "@/lib/wallet-fields"

function normalizeLabel(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function buildWalletMetadata(input: {
  trade_status?: unknown
  funding_cex?: unknown
  platform?: unknown
  planned_date?: unknown
}) {
  return {
    trade_status:
      input.trade_status !== undefined ? normalizeTradeStatus(input.trade_status) : undefined,
    funding_cex:
      input.funding_cex !== undefined ? normalizeFundingCex(input.funding_cex) : undefined,
    platform: input.platform !== undefined ? normalizePlatform(input.platform) : undefined,
    planned_date:
      input.planned_date !== undefined ? normalizePlannedDate(input.planned_date) : undefined,
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
      ...(metadata.trade_status !== undefined
        ? { trade_status: metadata.trade_status }
        : {}),
      ...(metadata.funding_cex !== undefined
        ? { funding_cex: metadata.funding_cex }
        : {}),
      ...(metadata.platform !== undefined ? { platform: metadata.platform } : {}),
      ...(metadata.planned_date !== undefined
        ? { planned_date: metadata.planned_date }
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
