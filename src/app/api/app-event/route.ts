import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const KINDS = ['install', 'open']
const PLATFORMS = ['android', 'ios', 'desktop', 'other']

/** Anonymous app usage ping: { device, kind: 'install' | 'open', platform }. At most one per device/kind/day. */
export async function POST(req: NextRequest) {
  const { device, kind, platform } = await req.json().catch(() => ({}))
  if (typeof device !== 'string' || !/^[a-z0-9-]{8,64}$/i.test(device) || !KINDS.includes(kind)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
  const { error } = await createAdminClient().from('app_events')
    .upsert({ device_id: device, kind, platform: PLATFORMS.includes(platform) ? platform : 'other' },
      { onConflict: 'device_id,kind,day', ignoreDuplicates: true })
  // table may not exist yet — never bother the visitor with it
  if (error) console.warn('[app-event]', error.message)
  return NextResponse.json({ ok: true })
}
