import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { userFromRequest } from '@/lib/streams'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/** Totals per room (never who voted), plus the caller's own picks if signed in. */
export async function GET(req: NextRequest) {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.from('room_votes').select('user_id, room')
    if (error) throw error
    const counts: Record<string, number> = {}
    const voters = new Set<string>()
    for (const v of data ?? []) {
      counts[v.room] = (counts[v.room] ?? 0) + 1
      voters.add(v.user_id)
    }
    const me = await userFromRequest(req).catch(() => null)
    const mine = me ? (data ?? []).filter(v => v.user_id === me.id).map(v => v.room) : []
    return NextResponse.json({ counts, voters: voters.size, mine })
  } catch {
    // table not created yet
    return NextResponse.json({ counts: {}, voters: 0, mine: [] })
  }
}
