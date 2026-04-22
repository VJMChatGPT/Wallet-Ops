import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()
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

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
