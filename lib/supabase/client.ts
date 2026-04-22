"use client"

import { createBrowserClient } from "@supabase/ssr"

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (client) return client
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!supabaseUrl || !/^https?:\/\//.test(supabaseUrl)) {
    throw new Error(
      "Invalid NEXT_PUBLIC_SUPABASE_URL. Use the Supabase Project URL, for example https://your-project.supabase.co"
    )
  }

  if (!supabaseKey) {
    throw new Error(
      "Missing Supabase key. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    )
  }

  client = createBrowserClient(
    supabaseUrl,
    supabaseKey
  )

  return client
}
