import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  try {
    const { user_id, action } = await req.json()
    if (!user_id || !action) {
      return NextResponse.json({ error: 'Missing user_id or action' }, { status: 400 })
    }
    if (!['login', 'register', 'post'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const ip = getIp(req)
    const userAgent = req.headers.get('user-agent') || ''

    const admin = createAdminClient()

    // Always write last_ip directly to profiles for login/register — reliable even if user_sessions table doesn't exist
    if (action === 'login' || action === 'register') {
      const { error: profileErr } = await admin
        .from('profiles')
        .update({ last_ip: ip })
        .eq('id', user_id)
      if (profileErr) console.error('[log-session] profiles.last_ip update error:', profileErr.message)
    }

    // Also insert into user_sessions (best-effort — table may not exist yet)
    const { error } = await admin.from('user_sessions').insert({
      user_id,
      ip_address: ip,
      user_agent: userAgent,
      action,
    })
    if (error) console.warn('[log-session] user_sessions insert (non-fatal):', error.message)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[log-session]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
