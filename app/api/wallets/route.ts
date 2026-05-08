import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { validateSolanaWalletAddress } from "@/lib/solana"
import {
  normalizeFundingCex,
  normalizePlatform,
  normalizePlannedDate,
  normalizeTradeStatus,
} from "@/lib/wallet-fields"

type WalletType = "mine" | "external"

interface WalletInput {
  address: string
  label?: string
  type?: WalletType
  trade_status?: string | null
  funding_cex?: string | null
  platform?: string | null
  planned_date?: string | null
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

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from("tracked_wallets")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
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

    const { data, error } = await supabase
      .from("tracked_wallets")
      .insert({
        address: normalizedAddress,
        label: normalizeLabel(label),
        type: normalizeWalletType(type),
        trade_status: normalizeTradeStatus(body.trade_status),
        funding_cex: normalizeFundingCex(body.funding_cex),
        platform: normalizePlatform(body.platform),
        planned_date: normalizePlannedDate(body.planned_date),
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

    return NextResponse.json(data, { status: 201 })
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
    trade_status: string | null
    funding_cex: string | null
    platform: string | null
    planned_date: string | null
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
      funding_cex: normalizeFundingCex(wallet.funding_cex),
      platform: normalizePlatform(wallet.platform),
      planned_date: normalizePlannedDate(wallet.planned_date),
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

    const { data, error: insertError } = await supabase
      .from("tracked_wallets")
      .insert(
        insertableWallets.map((wallet) => ({
          address: wallet.address,
          label: wallet.label,
          type: wallet.type,
          trade_status: wallet.trade_status,
          funding_cex: wallet.funding_cex,
          platform: wallet.platform,
          planned_date: wallet.planned_date,
        }))
      )
      .select()

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      wallets: data || [],
      failures,
      insertedCount: data?.length || 0,
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
      ...(body.trade_status !== undefined
        ? { trade_status: normalizeTradeStatus(body.trade_status) }
        : {}),
      ...(body.funding_cex !== undefined
        ? { funding_cex: normalizeFundingCex(body.funding_cex) }
        : {}),
      ...(body.platform !== undefined
        ? { platform: normalizePlatform(body.platform) }
        : {}),
      ...(body.planned_date !== undefined
        ? { planned_date: normalizePlannedDate(body.planned_date) }
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
    return toErrorResponse(error)
  }
}
