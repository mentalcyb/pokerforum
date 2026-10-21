import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createResilientFetch } from './resilientFetch'

// One shared client per browser tab. Components call createClient() on every render;
// with @supabase/ssr 0.3 each call made a new auth client, and several auth clients in one
// tab fight over the same browser lock — the loser waits ~10s, which delayed page loads.
let browserClient: SupabaseClient | null = null

export function createClient() {
  if (browserClient) return browserClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Missing Supabase configuration (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). ' +
      'Check environment variables in your deployment settings.'
    )
  }
  const client = createBrowserClient(url, key, {
    global: { fetch: createResilientFetch() },
  })
  // only cache in the browser; on the server every request needs its own client
  if (typeof window !== 'undefined') browserClient = client
  return client
}
