import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { validateSolanaWalletAddress } from "@/lib/solana"
import {
  normalizeFundedAt,
  normalizeFundingSourceLabel,
  normalizePlatform,
  normalizeTradeStatus,
} from "@/lib/wallet-fields"
import { detectAndPersistWalletFundingBatch } from "@/lib/funding-detection"
import { sortWalletsByOrder } from "@/lib/wallet-order"
import { getOrCreateMasterSheet } from "@/lib/sheets"
import type { TrackedWallet } from "@/lib/types"

type WalletType = "mine" | "external"

interface WalletInput {
  address: string
  label?: string
  type?: WalletType
  sort_order?: number | null
  trade_status?: string | null
  funding_source_label?: string | null
  platform?: string | null
  funded_at?: string | null
  lineNumber?: number
}

function normalizeWalletType(value: unknown): WalletType {
  return value === "external" ? "external" : "mine"
}

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

function toErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error"

  if (message.includes("fetch failed")) {
    return NextResponse.json(
      {
        error:
          "Failed to reach Supabase. Check your NEXT_PUBLIC_SUPABASE_URL, key, and network access.",
      },
      { status: 500 }
    )
  }

  return NextResponse.json({ error: message }, { status: 500 })
}

async function getNextSortOrder(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  const { data, error } = await supabase
    .from("tracked_wallets")
    .select("sort_order")
    .order("sort_order", { ascending: false, nullsFirst: false })
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  const currentMax =
    typeof data?.[0]?.sort_order === "number" ? data[0].sort_order : -1

  return currentMax + 1
}

async function syncWalletsToMasterSheet(
  supabase: Awaited<ReturnType<typeof createClient>>,
  wallets: TrackedWallet[],
  options: { updateExisting?: boolean } = {}
) {
  if (wallets.length === 0) {
    return
  }

  const masterSheet = await getOrCreateMasterSheet(supabase)
  const { data: existingRows, error: existingRowsError } = await supabase
    .from("sheet_wallets")
    .select("wallet_id")
    .eq("sheet_id", masterSheet.id)
    .in(
      "wallet_id",
      wallets.map((wallet) => wallet.id)
    )

  if (existingRowsError) {
    throw new Error(existingRowsError.message)
  }

  const existingWalletIds = new Set((existingRows || []).map((row) => row.wallet_id))
  const rowsToInsert = wallets
    .filter((wallet) => !existingWalletIds.has(wallet.id))
    .map((wallet, index) => ({
      sheet_id: masterSheet.id,
      wallet_id: wallet.id,
      row_order: wallet.sort_order ?? index,
      label: wallet.label,
      trade_status: wallet.trade_status,
      funding_source_label: wallet.funding_source_label,
      funding_source_address: wallet.funding_source_address,
      funding_label_source: wallet.funding_label_source,
      first_funder_address: wallet.first_funder_address,
      platform: wallet.platform,
      funded_at: wallet.funded_at,
      funding_detection_method: wallet.funding_detection_method,
      funding_detected_at: wallet.funding_detected_at,
    }))

  if (rowsToInsert.length === 0) {
    if (!options.updateExisting) {
      return
    }
  }

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabase.from("sheet_wallets").insert(rowsToInsert)
    if (insertError) {
      throw new Error(insertError.message)
    }
  }

  if (options.updateExisting) {
    for (const wallet of wallets) {
      const { error: updateError } = await supabase
        .from("sheet_wallets")
        .update({
          label: wallet.label,
          trade_status: wallet.trade_status,
          funding_source_label: wallet.funding_source_label,
          funding_source_address: wallet.funding_source_address,
          funding_label_source: wallet.funding_label_source,
          first_funder_address: wallet.first_funder_address,
          platform: wallet.platform,
          funded_at: wallet.funded_at,
          funding_detection_method: wallet.funding_detection_method,
          funding_detected_at: wallet.funding_detected_at,
          row_order: wallet.sort_order,
        })
        .eq("sheet_id", masterSheet.id)
        .eq("wallet_id", wallet.id)

      if (updateError) {
        throw new Error(updateError.message)
      }
    }
  }
}

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase.from("tracked_wallets").select("*")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(sortWalletsByOrder(data || []))
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()

    if (Array.isArray(body.wallets)) {
      return handleBulkCreate(supabase, body.wallets)
    }

    const { address, label, type = "mine" } = body

    if (!address) {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      )
    }

    const validation = validateSolanaWalletAddress(address)
    if (!validation.isValid || !validation.normalizedAddress) {
      return NextResponse.json(
        { error: validation.error || "Invalid Solana wallet address" },
        { status: 400 }
      )
    }

    const normalizedAddress = validation.normalizedAddress
    const sortOrder = await getNextSortOrder(supabase)
    const metadata = buildWalletMetadata(body)

    const { data, error } = await supabase
      .from("tracked_wallets")
      .insert({
        address: normalizedAddress,
        label: normalizeLabel(label),
        type: normalizeWalletType(type),
        sort_order: sortOrder,
        trade_status: normalizeTradeStatus(body.trade_status),
        funding_source_label: metadata.funding_source_label ?? null,
        platform: normalizePlatform(body.platform),
        funded_at: metadata.funded_at ?? null,
      })
      .select()
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Wallet already exists" },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const detectedWallets = await detectAndPersistWalletFundingBatch(supabase, [
      data as TrackedWallet,
    ])
    await syncWalletsToMasterSheet(supabase, detectedWallets, {
      updateExisting: true,
    })

    return NextResponse.json(detectedWallets[0], { status: 201 })
  } catch (error) {
    return toErrorResponse(error)
  }
}

async function handleBulkCreate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  wallets: WalletInput[]
) {
  if (wallets.length === 0) {
    return NextResponse.json(
      { error: "At least one wallet is required" },
      { status: 400 }
    )
  }

  const seen = new Map<string, number>()
  const failures: {
    address: string
    lineNumber: number | null
    error: string
  }[] = []
  const candidates: {
    address: string
    label: string | null
    type: WalletType
    sort_order?: number | null
    trade_status: string | null
    funding_source_label: string | null
    platform: string | null
    funded_at: string | null
    lineNumber: number | null
  }[] = []

  for (const wallet of wallets) {
    const rawAddress = typeof wallet.address === "string" ? wallet.address : ""
    const lineNumber = typeof wallet.lineNumber === "number" ? wallet.lineNumber : null
    const validation = validateSolanaWalletAddress(rawAddress)

    if (!validation.isValid || !validation.normalizedAddress) {
      failures.push({
        address: rawAddress.trim(),
        lineNumber,
        error: validation.error || "Invalid Solana wallet address",
      })
      continue
    }

    const normalizedAddress = validation.normalizedAddress
    if (seen.has(normalizedAddress)) {
      failures.push({
        address: normalizedAddress,
        lineNumber,
        error: `Duplicate of line ${seen.get(normalizedAddress)}`,
      })
      continue
    }

    seen.set(normalizedAddress, lineNumber ?? 0)
    candidates.push({
      address: normalizedAddress,
      label: normalizeLabel(wallet.label),
      type: normalizeWalletType(wallet.type),
      trade_status: normalizeTradeStatus(wallet.trade_status),
      funding_source_label: normalizeFundingSourceLabel(
        wallet.funding_source_label
      ),
      platform: normalizePlatform(wallet.platform),
      funded_at: normalizeFundedAt(wallet.funded_at),
      lineNumber,
    })
  }

  const candidateAddresses = candidates.map((wallet) => wallet.address)
  if (candidateAddresses.length > 0) {
    const { data: existingWallets, error } = await supabase
      .from("tracked_wallets")
      .select("address")
      .in("address", candidateAddresses)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const existingAddresses = new Set(
      (existingWallets || []).map((wallet) => wallet.address)
    )

    for (const wallet of candidates) {
      if (existingAddresses.has(wallet.address)) {
        failures.push({
          address: wallet.address,
          lineNumber: wallet.lineNumber,
          error: "Wallet already exists",
        })
      }
    }

    const insertableWallets = candidates.filter(
      (wallet) => !existingAddresses.has(wallet.address)
    )

    if (insertableWallets.length === 0) {
      return NextResponse.json(
        {
          wallets: [],
          failures,
          insertedCount: 0,
        }
      )
    }

    const nextSortOrder = await getNextSortOrder(supabase)

    const { data, error: insertError } = await supabase
      .from("tracked_wallets")
      .insert(
        insertableWallets.map((wallet, index) => ({
          address: wallet.address,
          label: wallet.label,
          type: wallet.type,
          sort_order: nextSortOrder + index,
          trade_status: wallet.trade_status,
          funding_source_label: wallet.funding_source_label,
          platform: wallet.platform,
          funded_at: wallet.funded_at,
        }))
      )
      .select()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    const detectedWallets = await detectAndPersistWalletFundingBatch(
      supabase,
      (data || []) as TrackedWallet[]
    )
    await syncWalletsToMasterSheet(supabase, detectedWallets, {
      updateExisting: true,
    })

    return NextResponse.json({
      wallets: detectedWallets,
      failures,
      insertedCount: detectedWallets.length,
    })
  }

  return NextResponse.json(
    {
      wallets: [],
      failures,
      insertedCount: 0,
    }
  )
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Wallet ID is required" },
        { status: 400 }
      )
    }

    const { error } = await supabase.from("tracked_wallets").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { id, address, label } = body

    if (!id) {
      return NextResponse.json(
        { error: "Wallet ID is required" },
        { status: 400 }
      )
    }

    let normalizedAddress: string | null = null
    if (address !== undefined) {
      if (!address) {
        return NextResponse.json(
          { error: "Wallet address is required" },
          { status: 400 }
        )
      }

      const validation = validateSolanaWalletAddress(address)
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
        return NextResponse.json(
          { error: existingWalletError.message },
          { status: 500 }
        )
      }

      if (existingWallet && existingWallet.id !== id) {
        return NextResponse.json({ error: "Wallet already exists" }, { status: 409 })
      }
    }

    const updatePayload = {
      ...(normalizedAddress ? { address: normalizedAddress } : {}),
      ...(label !== undefined ? { label: normalizeLabel(label) } : {}),
      ...(body.sort_order !== undefined
        ? { sort_order: normalizeSortOrder(body.sort_order) }
        : {}),
      ...(body.trade_status !== undefined
        ? { trade_status: normalizeTradeStatus(body.trade_status) }
        : {}),
      ...(body.funding_source_label !== undefined || body.funding_cex !== undefined
        ? {
            funding_source_label: normalizeFundingSourceLabel(
              body.funding_source_label ?? body.funding_cex
            ),
          }
        : {}),
      ...(body.platform !== undefined
        ? { platform: normalizePlatform(body.platform) }
        : {}),
      ...(body.funded_at !== undefined || body.planned_date !== undefined
        ? { funded_at: normalizeFundedAt(body.funded_at ?? body.planned_date) }
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
      ...(body.trade_status !== undefined
        ? { trade_status: normalizeTradeStatus(body.trade_status) }
        : {}),
      ...(body.funding_source_label !== undefined || body.funding_cex !== undefined
        ? {
            funding_source_label: normalizeFundingSourceLabel(
              body.funding_source_label ?? body.funding_cex
            ),
          }
        : {}),
      ...(body.platform !== undefined
        ? { platform: normalizePlatform(body.platform) }
        : {}),
      ...(body.funded_at !== undefined || body.planned_date !== undefined
        ? { funded_at: normalizeFundedAt(body.funded_at ?? body.planned_date) }
        : {}),
      ...(body.sort_order !== undefined
        ? { row_order: normalizeSortOrder(body.sort_order) }
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
    return toErrorResponse(error)
  }
}
