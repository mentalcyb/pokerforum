import { createBrowserClient } from '@supabase/ssr'
import { createResilientFetch } from './resilientFetch'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Missing Supabase configuration (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY). ' +
      'Check environment variables in your deployment settings.'
    )
  }
  return createBrowserClient(url, key, {
    global: { fetch: createResilientFetch() },
  })
}
