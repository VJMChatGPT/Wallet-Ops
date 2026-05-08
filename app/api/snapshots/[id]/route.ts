import { NextResponse } from "next/server"
import { normalizeSnapshotDetail } from "@/lib/snapshots"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const [{ data: snapshot, error: snapshotError }, { data: wallets, error: walletsError }] =
      await Promise.all([
        supabase.from("portfolio_snapshots").select("*").eq("id", id).single(),
        supabase
          .from("portfolio_snapshot_wallets")
          .select("*")
          .eq("snapshot_id", id)
          .order("selected_token_balance", { ascending: false }),
      ])

    if (snapshotError) {
      const status = snapshotError.code === "PGRST116" ? 404 : 500
      return NextResponse.json({ error: snapshotError.message }, { status })
    }

    if (walletsError) {
      return NextResponse.json({ error: walletsError.message }, { status: 500 })
    }

    return NextResponse.json(normalizeSnapshotDetail(snapshot, wallets || []))
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load snapshot",
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
    const { error } = await supabase.from("portfolio_snapshots").delete().eq("id", id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete snapshot",
      },
      { status: 500 }
    )
  }
}
