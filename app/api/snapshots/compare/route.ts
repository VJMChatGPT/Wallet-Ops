import { NextResponse } from "next/server"
import { compareSnapshots } from "@/lib/snapshots"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    if (!from || !to) {
      return NextResponse.json(
        { error: "Both from and to snapshot IDs are required" },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const [
      { data: fromSnapshot, error: fromError },
      { data: toSnapshot, error: toError },
      { data: fromWallets, error: fromWalletsError },
      { data: toWallets, error: toWalletsError },
    ] = await Promise.all([
      supabase.from("portfolio_snapshots").select("*").eq("id", from).single(),
      supabase.from("portfolio_snapshots").select("*").eq("id", to).single(),
      supabase.from("portfolio_snapshot_wallets").select("*").eq("snapshot_id", from),
      supabase.from("portfolio_snapshot_wallets").select("*").eq("snapshot_id", to),
    ])

    if (fromError || toError) {
      return NextResponse.json(
        { error: fromError?.message || toError?.message || "Snapshot not found" },
        { status: 404 }
      )
    }

    if (fromWalletsError || toWalletsError) {
      return NextResponse.json(
        {
          error:
            fromWalletsError?.message ||
            toWalletsError?.message ||
            "Failed to load snapshot wallets",
        },
        { status: 500 }
      )
    }

    if (fromSnapshot.sheet_id !== toSnapshot.sheet_id) {
      return NextResponse.json(
        { error: "Snapshots must belong to the same sheet to be compared" },
        { status: 400 }
      )
    }

    if (
      fromSnapshot.selected_token_mint &&
      toSnapshot.selected_token_mint &&
      fromSnapshot.selected_token_mint !== toSnapshot.selected_token_mint
    ) {
      return NextResponse.json(
        { error: "Snapshots must use the same selected token to be compared" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      compareSnapshots(
        fromSnapshot,
        toSnapshot,
        fromWallets || [],
        toWallets || []
      )
    )
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to compare snapshots",
      },
      { status: 500 }
    )
  }
}
