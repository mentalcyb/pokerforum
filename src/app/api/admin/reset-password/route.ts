import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { createAdminClient } from '@/lib/supabase-admin'
import { ownerFromRequest } from '@/lib/ownerAuth'

export const dynamic = 'force-dynamic'

// easy to read out or type: no 0/O, 1/l/I
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
function newPassword(): string {
  let s = ''
  for (let i = 0; i < 10; i++) s += ALPHABET[randomInt(ALPHABET.length)]
  return `${s.slice(0, 5)}-${s.slice(5)}`
}

/** Owner only: give a member a new password (after checking who they are). { username } */
export async function POST(req: NextRequest) {
  const owner = await ownerFromRequest(req)
  if (!owner) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { username } = await req.json().catch(() => ({}))
  const name = String(username ?? '').trim()
  if (!name) return NextResponse.json({ error: 'username' }, { status: 400 })
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, username').ilike('username', name).maybeSingle()
  if (!profile) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (profile.id === owner.id) return NextResponse.json({ error: 'self' }, { status: 400 })
  const password = newPassword()
  const { data, error } = await admin.auth.admin.updateUserById(profile.id, { password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  console.log(`[owner] password reset for ${profile.username} by ${owner.email}`)
  return NextResponse.json({ username: profile.username, email: data.user?.email ?? '', password })
}
