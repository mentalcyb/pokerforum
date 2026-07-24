import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function GET() {
  const startedAt = Date.now()

  try {
    const admin = createAdminClient()
    const { error } = await admin.from('categories').select('id', { count: 'exact', head: true })
    if (error) throw error

    return NextResponse.json(
      { status: 'ok', supabase: 'reachable', latency_ms: Date.now() - startedAt, timestamp: new Date().toISOString() },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err) {
    console.error('[health] Supabase unreachable:', err)
    return NextResponse.json(
      {
        status: 'error',
        supabase: 'unreachable',
        message: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
