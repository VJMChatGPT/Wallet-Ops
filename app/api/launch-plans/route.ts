import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createLaunchPlan, listLaunchPlans } from "@/lib/launch-planner"

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export async function GET() {
  try {
    const supabase = await createClient()
    const plans = await listLaunchPlans(supabase)
    return NextResponse.json({ plans })
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to load launch plans") },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))
    const detail = await createLaunchPlan(supabase, body)
    return NextResponse.json(detail, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to create launch plan") },
      { status: 500 }
    )
  }
}
