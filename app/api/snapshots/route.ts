import { NextResponse } from "next/server"
import { getLiveHoldingsData } from "@/lib/holdings"
import {
  buildSnapshotInsert,
  buildSnapshotWalletRows,
  normalizeSnapshot,
} from "@/lib/snapshots"
import { createClient } from "@/lib/supabase/server"

function normalizeName(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const sheetId = searchParams.get("sheetId")

    let query = supabase
      .from("portfolio_snapshots")
      .select("*")
      .order("created_at", { ascending: false })

    if (sheetId) {
      query = query.eq("sheet_id", sheetId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      snapshots: (data || []).map(normalizeSnapshot),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load snapshots",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))
    const name = normalizeName(body?.name)
    const sheetId =
      typeof body?.sheetId === "string" && body.sheetId.trim()
        ? body.sheetId.trim()
        : null

    if (!sheetId) {
      return NextResponse.json(
        { error: "sheetId is required" },
        { status: 400 }
      )
    }

    const holdings = await getLiveHoldingsData(supabase, {
      sheetId,
    })

    const { data: snapshot, error: snapshotError } = await supabase
      .from("portfolio_snapshots")
      .insert(buildSnapshotInsert(holdings, name))
      .select("*")
      .single()

    if (snapshotError || !snapshot) {
      return NextResponse.json(
        { error: snapshotError?.message || "Failed to create snapshot" },
        { status: 500 }
      )
    }

    const walletRows = buildSnapshotWalletRows(holdings.walletSummaries)

    if (walletRows.length > 0) {
      const { error: walletsError } = await supabase
        .from("portfolio_snapshot_wallets")
        .insert(
          walletRows.map((wallet) => ({
            snapshot_id: snapshot.id,
            ...wallet,
          }))
        )

      if (walletsError) {
        await supabase.from("portfolio_snapshots").delete().eq("id", snapshot.id)
        return NextResponse.json(
          { error: walletsError.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json(
      {
        snapshot: normalizeSnapshot(snapshot),
        savedWallets: walletRows.length,
      },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save snapshot",
      },
      { status: 500 }
    )
  }
}
