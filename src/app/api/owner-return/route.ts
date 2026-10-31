import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { readReturnTicket } from '@/lib/ownerTicket'

export const dynamic = 'force-dynamic'

/** From a test account back to the owner's own account: { ticket } → one-time login token. */
export async function POST(req: NextRequest) {
  const { ticket } = await req.json().catch(() => ({}))
  const ownerId = readReturnTicket(ticket)
  if (!ownerId) return NextResponse.json({ error: 'expired' }, { status: 401 })
  const admin = createAdminClient()
  const { data } = await admin.auth.admin.getUserById(ownerId)
  const email = data?.user?.email?.toLowerCase()
  const owners = (process.env.OWNER_EMAIL ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  if (!email || !owners.includes(email)) return NextResponse.json({ error: 'not owner' }, { status: 403 })
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error || !link.properties?.hashed_token) return NextResponse.json({ error: error?.message ?? 'link failed' }, { status: 500 })
  return NextResponse.json({ token_hash: link.properties.hashed_token })
}
