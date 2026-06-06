import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    // Verify caller is an admin using their session token
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    // Verify token and get user
    const { data: { user }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check admin flag
    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Fetch all profiles (including last_ip written directly on login)
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, username, is_banned, is_admin, is_moderator, created_at, last_ip')
      .order('created_at', { ascending: false })

    // Fetch recent sessions (last 200)
    const { data: sessions } = await admin
      .from('user_sessions')
      .select('id, user_id, ip_address, user_agent, action, created_at, profiles(username)')
      .order('created_at', { ascending: false })
      .limit(200)

    // Fetch post counts per user
    const { data: postCounts } = await admin
      .from('posts')
      .select('user_id')

    const countMap: Record<string, number> = {}
    for (const p of postCounts ?? []) {
      countMap[p.user_id] = (countMap[p.user_id] ?? 0) + 1
    }

    // Build last-login and last-IP per user from sessions
    const lastLogin: Record<string, string> = {}
    const lastIp: Record<string, string> = {}
    for (const s of [...(sessions ?? [])].reverse()) {
      if (s.action === 'login' || s.action === 'register') {
        lastLogin[s.user_id] = s.created_at
        lastIp[s.user_id] = s.ip_address
      }
    }

    // Fetch emails via admin auth API
    const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const emailMap: Record<string, string> = {}
    for (const u of authUsers?.users ?? []) {
      emailMap[u.id] = u.email ?? ''
    }

    const enrichedUsers = (profiles ?? []).map(p => ({
      ...p,
      email: emailMap[p.id] ?? '',
      post_count: countMap[p.id] ?? 0,
      last_login: lastLogin[p.id] ?? null,
      // Use profiles.last_ip as primary source; fall back to sessions map
      // Never expose IP for admin accounts
      last_ip: p.is_admin ? null : ((p as any).last_ip ?? lastIp[p.id] ?? null),
    }))

    return NextResponse.json({ users: enrichedUsers, sessions: sessions ?? [] })
  } catch (err) {
    console.error('[admin/security]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
