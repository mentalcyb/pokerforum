'use client'
import { createClient } from '@/lib/supabase'

/** fetch() for the home-games API, sending the signed-in user's token. */
export async function homeGamesFetch<T = unknown>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  try {
    const res = await fetch(`/api/home-games${path}`, {
      method: init.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: json.error ?? 'server_error', status: res.status }
    return { ok: true, data: json as T }
  } catch {
    return { ok: false, error: 'network', status: 0 }
  }
}
