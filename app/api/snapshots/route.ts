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

export async function GET() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("portfolio_snapshots")
      .select("*")
      .order("created_at", { ascending: false })

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
    const selectedTokenMint =
      typeof body?.selectedTokenMint === "string" && body.selectedTokenMint.trim()
        ? body.selectedTokenMint.trim()
        : null
    const holdings = await getLiveHoldingsData(supabase, {
      tokenMint: selectedTokenMint,
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
