import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const owners = () => (process.env.OWNER_EMAIL ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)

/**
 * Member management, checked on the server:
 *  - ban / unban: admins and moderators (moderators can't ban admins or other moderators)
 *  - make/remove admin or moderator, delete: admins only
 *  - nobody can act on themselves or on the site owner
 * { action: 'ban' | 'unban' | 'admin' | 'unadmin' | 'mod' | 'unmod' | 'delete', userId }
 */
export async function POST(req: NextRequest) {
  const admin = createAdminClient()
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const { data: { user: caller } } = await admin.auth.getUser(token)
  if (!caller) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data: me } = await admin.from('profiles').select('is_admin, is_moderator').eq('id', caller.id).single()
  const isAdmin = !!me?.is_admin || owners().includes(caller.email?.toLowerCase() ?? '')
  const isMod = !!me?.is_moderator
  if (!isAdmin && !isMod) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { action, userId } = await req.json().catch(() => ({}))
  if (typeof userId !== 'string' || userId === caller.id) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  const { data: target } = await admin.from('profiles').select('is_admin, is_moderator').eq('id', userId).maybeSingle()
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const { data: targetAuth } = await admin.auth.admin.getUserById(userId)
  if (owners().includes(targetAuth?.user?.email?.toLowerCase() ?? '')) return NextResponse.json({ error: 'owner' }, { status: 403 })

  const adminOnly = ['admin', 'unadmin', 'mod', 'unmod', 'delete'].includes(action)
  if (adminOnly && !isAdmin) return NextResponse.json({ error: 'admins_only' }, { status: 403 })
  if (!isAdmin && (target.is_admin || target.is_moderator)) return NextResponse.json({ error: 'admins_only' }, { status: 403 })

  const update: Record<string, boolean> | null =
    action === 'ban' ? { is_banned: true } : action === 'unban' ? { is_banned: false }
    : action === 'admin' ? { is_admin: true } : action === 'unadmin' ? { is_admin: false }
    : action === 'mod' ? { is_moderator: true } : action === 'unmod' ? { is_moderator: false } : null

  if (update) {
    const { error } = await admin.from('profiles').update(update).eq('id', userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (action === 'delete') {
    await admin.from('replies').delete().eq('user_id', userId)
    await admin.from('posts').delete().eq('user_id', userId)
    await admin.from('profiles').delete().eq('id', userId)
    await admin.auth.admin.deleteUser(userId)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'bad request' }, { status: 400 })
}
