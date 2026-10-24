import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/** Admin: how many devices installed / use the app. */
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data, error } = await createAdminClient().from('app_events').select('device_id, kind, platform, day').limit(100000)
  if (error) return NextResponse.json({ error: 'missing_table' }, { status: 200 })
  const today = new Date().toISOString().slice(0, 10)
  const since7 = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10)
  const since30 = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
  const all = new Set<string>(), active7 = new Set<string>(), active30 = new Set<string>(), todaySet = new Set<string>()
  const byPlatform: Record<string, Set<string>> = {}
  for (const e of data ?? []) {
    all.add(e.device_id)
    ;(byPlatform[e.platform] ??= new Set()).add(e.device_id)
    if (e.kind === 'open') {
      if (e.day >= since30) active30.add(e.device_id)
      if (e.day >= since7) active7.add(e.device_id)
      if (e.day === today) todaySet.add(e.device_id)
    }
  }
  return NextResponse.json({
    installed: all.size,
    today: todaySet.size,
    active7: active7.size,
    active30: active30.size,
    platforms: Object.fromEntries(Object.entries(byPlatform).map(([k, v]) => [k, v.size])),
  })
}
