import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getLaunchPlanDetail, updateLaunchPlan } from "@/lib/launch-planner"

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const detail = await getLaunchPlanDetail(supabase, id)
    return NextResponse.json(detail)
  } catch (error) {
    const message = getErrorMessage(error, "Failed to load launch plan")
    return NextResponse.json(
      { error: message },
      { status: message === "Launch plan not found" ? 404 : 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))
    const detail = await updateLaunchPlan(supabase, id, body)
    return NextResponse.json(detail)
  } catch (error) {
    const message = getErrorMessage(error, "Failed to update launch plan")
    return NextResponse.json(
      { error: message },
      { status: message === "Launch plan not found" ? 404 : 500 }
    )
  }
}
