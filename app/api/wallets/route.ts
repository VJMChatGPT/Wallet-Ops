import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("tracked_wallets")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  const { address, label, type = "mine" } = body

  if (!address) {
    return NextResponse.json(
      { error: "Wallet address is required" },
      { status: 400 }
    )
  }

  // Validate Solana address format (base58, 32-44 chars)
  const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
  if (!solanaAddressRegex.test(address)) {
    return NextResponse.json(
      { error: "Invalid Solana wallet address" },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from("tracked_wallets")
    .insert({ address, label, type })
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
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Wallet ID is required" }, { status: 400 })
  }

  const { error } = await supabase.from("tracked_wallets").delete().eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
