import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { ownerFromRequest } from '@/lib/ownerAuth'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/** Owner only: a member's current role. ?userId=… */
export async function GET(req: NextRequest) {
  if (!(await ownerFromRequest(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const userId = req.nextUrl.searchParams.get('userId') ?? ''
  const { data } = await createAdminClient().from('profiles').select('is_admin, is_moderator').eq('id', userId).maybeSingle()
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ role: data.is_admin ? 'admin' : data.is_moderator ? 'moderator' : 'member' })
}

/** Owner only: { userId, role: 'admin' | 'moderator' | 'member' } */
export async function POST(req: NextRequest) {
  const owner = await ownerFromRequest(req)
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { userId, role } = await req.json().catch(() => ({}))
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
