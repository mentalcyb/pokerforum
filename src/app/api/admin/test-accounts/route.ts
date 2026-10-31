import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/**
 * Admin-only test accounts: created here (no registration form, no e-mail), and entered with
 * one click from the admin panel (a one-time login token — no password, no IP/login logging).
 * They're recognised by app_metadata.test_account, which only the server can set.
 */
async function listTestAccounts() {
  const admin = createAdminClient()
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const users = (data?.users ?? []).filter(u => u.app_metadata?.test_account)
  if (!users.length) return []
  const { data: profiles } = await admin.from('profiles').select('id, username').in('id', users.map(u => u.id))
  const names = new Map((profiles ?? []).map(p => [p.id, p.username]))
  return users.map(u => ({ id: u.id, username: names.get(u.id) ?? '—', created_at: u.created_at }))
}

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ accounts: await listTestAccounts() })
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient()

  if (body.action === 'create') {
    const username = String(body.username ?? '').trim()
    if (username.length < 2 || username.length > 30) return NextResponse.json({ error: 'username' }, { status: 400 })
    const { data: taken } = await admin.from('profiles').select('id').ilike('username', username).maybeSingle()
    if (taken) return NextResponse.json({ error: 'taken' }, { status: 409 })
    const email = `t-${randomBytes(6).toString('hex')}@test.pokerforum.ge`
    const { data, error } = await admin.auth.admin.createUser({
      email, password: randomBytes(24).toString('base64url'), email_confirm: true,
      user_metadata: { username }, app_metadata: { test_account: true },
    })
    if (error || !data.user) return NextResponse.json({ error: error?.message ?? 'create failed' }, { status: 500 })
    // the database may already create the profile row for every new user, so set the nickname either way
    const prof = await admin.from('profiles').upsert({ id: data.user.id, username }, { onConflict: 'id' })
    if (prof.error) {
      await admin.auth.admin.deleteUser(data.user.id)
      return NextResponse.json({ error: prof.error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, accounts: await listTestAccounts() })
  }

  // only accounts created here can be entered or removed this way
  const { data: target } = await admin.auth.admin.getUserById(String(body.id ?? ''))
  const user = target?.user
  if (!user?.app_metadata?.test_account || !user.email) return NextResponse.json({ error: 'not a test account' }, { status: 400 })

  if (body.action === 'login') {
    const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: user.email })
    if (error || !data.properties?.hashed_token) return NextResponse.json({ error: error?.message ?? 'link failed' }, { status: 500 })
    return NextResponse.json({ token_hash: data.properties.hashed_token })
  }

  if (body.action === 'delete') {
    await admin.from('profiles').delete().eq('id', user.id)
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, accounts: await listTestAccounts() })
  }

  return NextResponse.json({ error: 'bad request' }, { status: 400 })
}
