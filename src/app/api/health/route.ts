import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase-admin'

type CheckResult = { ok: boolean; detail?: string }

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timeoutId!)
  }
}

// Database reachability via the service-role key — confirms the Supabase
// project itself is up and not paused.
async function checkDatabase(): Promise<CheckResult> {
  try {
    const admin = createAdminClient()
    const { error } = await withTimeout(
      admin.from('categories').select('id', { count: 'exact', head: true }),
      8000
    )
    if (error) throw error
    return { ok: true }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

// Anon-key path, subject to RLS — this is what real visitors' browsers hit,
// so it catches RLS misconfiguration or a rotated/revoked anon key that the
// service-role check above wouldn't.
async function checkPublicApi(): Promise<CheckResult> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
    const anon = createSupabaseClient(url, anonKey)
    const { error } = await withTimeout(
      anon.from('categories').select('id', { count: 'exact', head: true }),
      8000
    )
    if (error) throw error
    return { ok: true }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

// GoTrue (Supabase Auth) directly — the service behind signup/login. This is
// what actually breaks if "auth is down" but the database is otherwise fine.
async function checkAuth(): Promise<CheckResult> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!url) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    try {
      const res = await fetch(`${url}/auth/v1/health`, { signal: controller.signal, cache: 'no-store' })
      if (!res.ok) throw new Error(`auth health endpoint returned ${res.status}`)
      return { ok: true }
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

export async function GET() {
  const startedAt = Date.now()

  const [database, publicApi, auth] = await Promise.all([
    checkDatabase(),
    checkPublicApi(),
    checkAuth(),
  ])

  const checks = { database, publicApi, auth }
  const allOk = Object.values(checks).every(c => c.ok)

  if (!allOk) {
    console.error('[health] one or more checks failed:', checks)
  }

  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'error',
      checks,
      latency_ms: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  )
}
