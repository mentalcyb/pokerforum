import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { userFromRequest } from '@/lib/streams'
import { ROOM_IDS, MAX_ROOMS_PER_USER } from '@/data/rooms'

export const dynamic = 'force-dynamic'

/** Replace the signed-in member's picks: { rooms: ['ggpoker', ...] } (up to 3). */
export async function POST(req: NextRequest) {
  const me = await userFromRequest(req)
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const rooms = Array.from(new Set<string>(Array.isArray(body.rooms) ? body.rooms : []))
    .filter(r => ROOM_IDS.has(r)).slice(0, MAX_ROOMS_PER_USER)
  const admin = createAdminClient()
  const del = await admin.from('room_votes').delete().eq('user_id', me.id)
  if (del.error) return NextResponse.json({ error: del.error.message }, { status: 500 })
  if (rooms.length) {
    const ins = await admin.from('room_votes').insert(rooms.map(room => ({ user_id: me.id, room })))
    if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, rooms })
}
