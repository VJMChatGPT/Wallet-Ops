import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listSheets } from "@/lib/sheets"

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const body = await request.json().catch(() => ({}))
    const requestedSheetIds = Array.isArray(body.sheetIds)
      ? body.sheetIds.filter((value: unknown): value is string => typeof value === "string")
      : []

    const sheets = await listSheets(supabase)
    const masterSheet = sheets.find((sheet) => sheet.type === "master")
    const launchSheets = sheets.filter((sheet) => sheet.type === "launch")
    const launchSheetIdSet = new Set(launchSheets.map((sheet) => sheet.id))

    const orderedLaunchIds = requestedSheetIds.filter((sheetId: string) =>
      launchSheetIdSet.has(sheetId)
    )
    const missingLaunchIds = launchSheets
      .map((sheet) => sheet.id)
      .filter((sheetId) => !orderedLaunchIds.includes(sheetId))
    const finalLaunchIds = [...orderedLaunchIds, ...missingLaunchIds]
    const updates = []

    if (masterSheet) {
      updates.push(
        supabase
          .from("sheets")
          .update({ sort_order: 0, updated_at: new Date().toISOString() })
          .eq("id", masterSheet.id)
      )
    }

    finalLaunchIds.forEach((sheetId, index) => {
      updates.push(
        supabase
          .from("sheets")
          .update({ sort_order: index + 1, updated_at: new Date().toISOString() })
          .eq("id", sheetId)
      )
    })

    const results = await Promise.all(updates)
    const firstError = results.find((result) => result.error)?.error

    if (firstError) {
      return NextResponse.json({ error: firstError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to reorder sheets",
      },
      { status: 500 }
    )
  }
}
