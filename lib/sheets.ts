import { enrichWalletFundingMetadata } from "@/lib/funding-detection"
import { compareWalletOrder } from "@/lib/wallet-order"
import type { SheetWallet, TrackedWallet, WorkbookSheet } from "@/lib/types"

type SupabaseClientLike = Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>

interface SheetWalletRowRecord extends SheetWallet {
  wallet: TrackedWallet | null
}

export interface MergedSheetWallet {
  sheetId: string
  walletId: string
  address: string
  type: "mine" | "external"
  label: string | null
  row_order: number
  trade_status: string | null
  funding_source_label: string | null
  funding_source_address: string | null
  funding_label_source: string | null
  first_funder_address: string | null
  platform: string | null
  funded_at: string | null
  funding_detection_method: string | null
  funding_detected_at: string | null
  created_at: string
}

function normalizeSheetName(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function sortSheetsByOrder<T extends Pick<WorkbookSheet, "type" | "sort_order" | "created_at" | "name">>(
  sheets: T[]
) {
  return [...sheets].sort((left, right) => {
    if (left.type === "master" && right.type !== "master") return -1
    if (left.type !== "master" && right.type === "master") return 1

    if (left.sort_order !== right.sort_order) {
      return left.sort_order - right.sort_order
    }

    if (left.created_at !== right.created_at) {
      return left.created_at.localeCompare(right.created_at)
    }

    return left.name.localeCompare(right.name)
  })
}

export async function getOrCreateMasterSheet(supabase: SupabaseClientLike) {
  const { data: existing, error: existingError } = await supabase
    .from("sheets")
    .select("*")
    .eq("type", "master")
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }

  if (existing) {
    return existing as WorkbookSheet
  }

  const { data: created, error: createError } = await supabase
    .from("sheets")
    .insert({
      name: "All Wallets",
      type: "master",
      sort_order: 0,
    })
    .select("*")
    .single()

  if (createError || !created) {
    throw new Error(createError?.message || "Failed to create master sheet")
  }

  return created as WorkbookSheet
}

export async function ensureMasterSheetWallets(supabase: SupabaseClientLike) {
  const masterSheet = await getOrCreateMasterSheet(supabase)

  const [{ data: wallets, error: walletsError }, { data: rows, error: rowsError }] =
    await Promise.all([
      supabase.from("tracked_wallets").select("*"),
      supabase
        .from("sheet_wallets")
        .select("wallet_id")
        .eq("sheet_id", masterSheet.id),
    ])

  if (walletsError) {
    throw new Error(walletsError.message)
  }

  if (rowsError) {
    throw new Error(rowsError.message)
  }

  const existingWalletIds = new Set((rows || []).map((row) => row.wallet_id))
  const missingWallets = ((wallets || []) as TrackedWallet[]).filter(
    (wallet) => !existingWalletIds.has(wallet.id)
  )

  if (missingWallets.length === 0) {
    return masterSheet
  }

  const orderedWallets = [...missingWallets].sort(compareWalletOrder)

  const { error: insertError } = await supabase.from("sheet_wallets").insert(
    orderedWallets.map((wallet, index) => ({
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
  )

  if (insertError) {
    throw new Error(insertError.message)
  }

  return masterSheet
}

export async function listSheets(
  supabase: SupabaseClientLike,
  options: { includeArchived?: boolean } = {}
) {
  await ensureMasterSheetWallets(supabase)

  let query = supabase.from("sheets").select("*")
  if (!options.includeArchived) {
    query = query.is("archived_at", null)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const sheets = sortSheetsByOrder((data || []) as WorkbookSheet[])
  const [{ data: counts, error: countsError }] = await Promise.all([
    supabase.from("sheet_wallets").select("sheet_id"),
  ])

  if (countsError) {
    throw new Error(countsError.message)
  }

  const countMap = new Map<string, number>()
  for (const row of counts || []) {
    countMap.set(row.sheet_id, (countMap.get(row.sheet_id) || 0) + 1)
  }

  return sheets.map((sheet) => ({
    ...sheet,
    wallet_count: countMap.get(sheet.id) || 0,
  }))
}

export async function getSheetById(supabase: SupabaseClientLike, sheetId: string) {
  await ensureMasterSheetWallets(supabase)

  const { data, error } = await supabase
    .from("sheets")
    .select("*")
    .eq("id", sheetId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as WorkbookSheet | null) ?? null
}

export async function getNextSheetSortOrder(supabase: SupabaseClientLike) {
  const { data, error } = await supabase
    .from("sheets")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)

  if (error) {
    throw new Error(error.message)
  }

  const currentMax =
    typeof data?.[0]?.sort_order === "number" ? data[0].sort_order : 0
  return currentMax + 1
}

export async function getMergedSheetWallets(
  supabase: SupabaseClientLike,
  sheet: WorkbookSheet
) {
  const { data, error } = await supabase
    .from("sheet_wallets")
    .select(
      "id, sheet_id, wallet_id, row_order, label, trade_status, funding_source_label, funding_source_address, funding_label_source, first_funder_address, platform, funded_at, funding_detection_method, funding_detected_at, created_at, wallet:tracked_wallets(*)"
    )
    .eq("sheet_id", sheet.id)
    .order("row_order", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const rawRows = (data || []) as unknown as SheetWalletRowRecord[]
  const globalWallets = rawRows
    .map((row) => row.wallet)
    .filter((wallet): wallet is TrackedWallet => Boolean(wallet))
  const enrichedWallets = await enrichWalletFundingMetadata(supabase, globalWallets)
  const enrichedById = new Map(enrichedWallets.map((wallet) => [wallet.id, wallet]))
  const isMasterSheet = sheet.type === "master"

  const merged = rawRows
    .map((row) => {
      const wallet = enrichedById.get(row.wallet_id) || row.wallet
      if (!wallet) {
        return null
      }

      return {
        sheetId: row.sheet_id,
        walletId: wallet.id,
        address: wallet.address,
        type: wallet.type,
        label: row.label ?? (isMasterSheet ? wallet.label : null),
        row_order: row.row_order,
        trade_status: row.trade_status,
        funding_source_label:
          row.funding_source_label ?? (isMasterSheet ? wallet.funding_source_label : null),
        funding_source_address:
          row.funding_source_address ??
          (isMasterSheet ? wallet.funding_source_address : null),
        funding_label_source:
          row.funding_label_source ?? (isMasterSheet ? wallet.funding_label_source : null),
        first_funder_address:
          row.first_funder_address ?? (isMasterSheet ? wallet.first_funder_address : null),
        platform: row.platform,
        funded_at: row.funded_at ?? (isMasterSheet ? wallet.funded_at : null),
        funding_detection_method:
          row.funding_detection_method ??
          (isMasterSheet ? wallet.funding_detection_method : null),
        funding_detected_at:
          row.funding_detected_at ??
          (isMasterSheet ? wallet.funding_detected_at : null),
        created_at: wallet.created_at,
      } satisfies MergedSheetWallet
    })
    .filter((row): row is MergedSheetWallet => Boolean(row))

  return merged.sort((left, right) => {
    if (left.row_order !== right.row_order) {
      return left.row_order - right.row_order
    }

    if (left.created_at !== right.created_at) {
      return left.created_at.localeCompare(right.created_at)
    }

    return left.address.localeCompare(right.address)
  })
}

export async function getMasterSheetWalletSourceMap(supabase: SupabaseClientLike) {
  const masterSheet = await getOrCreateMasterSheet(supabase)
  await ensureMasterSheetWallets(supabase)
  const masterRows = await getMergedSheetWallets(supabase, masterSheet)

  return {
    masterSheet,
    rowsByWalletId: new Map(masterRows.map((row) => [row.walletId, row])),
  }
}

export function buildSheetWalletInsert(row: MergedSheetWallet, sheetId: string, rowOrder: number) {
  return {
    sheet_id: sheetId,
    wallet_id: row.walletId,
    row_order: rowOrder,
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
  }
}

export function normalizeSheetPayload(input: {
  name?: unknown
  token_mint?: unknown
  token_symbol?: unknown
}) {
  const name = normalizeSheetName(input.name)
  if (!name) {
    throw new Error("Sheet name is required")
  }

  const tokenMint = normalizeSheetName(input.token_mint)
  const tokenSymbol = normalizeSheetName(input.token_symbol)

  return {
    name,
    token_mint: tokenMint,
    token_symbol: tokenSymbol,
  }
}
