import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase-admin'
import { CONCIERGE_LANGS, WELCOME } from '@/lib/concierge'

export const dynamic = 'force-dynamic'

/** A visitor opens a chat in their language: { lang } → { id, token } */
export async function POST(req: NextRequest) {
  const { lang } = await req.json().catch(() => ({}))
  if (!CONCIERGE_LANGS[lang]) return NextResponse.json({ error: 'lang' }, { status: 400 })
  const admin = createAdminClient()
  const token = randomBytes(24).toString('base64url')
  const { data, error } = await admin.from('concierge_chats').insert({ token, lang }).select('id').single()
  if (error || !data) return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  await admin.from('concierge_messages').insert({ chat_id: data.id, sender: 'bot', text: WELCOME[lang], text_ka: WELCOME.ka })
  return NextResponse.json({ id: data.id, token })
}
