import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { ownerFromRequest } from '@/lib/ownerAuth'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/** Owner only: a member's current role. ?userId=… */
export async function GET(req: NextRequest) {
  if (!(await ownerFromRequest(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = req.nextUrl.searchParams.get('userId') ?? ''
  const admin = createAdminClient()
  let { data, error } = await admin.from('profiles').select('is_admin, is_moderator, can_approve_streams').eq('id', userId).maybeSingle()
  // before supabase/stream_approvers.sql: no permission column yet
  if (error) ({ data } = await admin.from('profiles').select('is_admin, is_moderator').eq('id', userId).maybeSingle() as any)
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({
    role: data.is_admin ? 'admin' : data.is_moderator ? 'moderator' : 'member',
    streams: (data as { can_approve_streams?: boolean }).can_approve_streams ?? null,
  })
}

/** Owner only: { userId, role: 'admin' | 'moderator' | 'member' } */
export async function POST(req: NextRequest) {
  const owner = await ownerFromRequest(req)
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { userId, role, streams } = await req.json().catch(() => ({}))
  // extra permission: approve streamers
  if (typeof userId === 'string' && typeof streams === 'boolean' && role === undefined) {
    if (userId === owner.id) return NextResponse.json({ error: 'self' }, { status: 400 })
    const { error } = await createAdminClient().from('profiles').update({ can_approve_streams: streams }).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, streams })
  }
  if (typeof userId !== 'string' || !['admin', 'moderator', 'member'].includes(role)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
  if (userId === owner.id) return NextResponse.json({ error: 'self' }, { status: 400 })
  const { error } = await createAdminClient().from('profiles')
    .update({ is_admin: role === 'admin', is_moderator: role === 'moderator' }).eq('id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  console.log(`[owner] ${owner.email} set role ${role} for ${userId}`)
  return NextResponse.json({ ok: true, role })
}
