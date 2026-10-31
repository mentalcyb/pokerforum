import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { guestChat } from '@/lib/concierge'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/** Visitor's messages after a given id: ?id=&token=&after= */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams
  const chat = await guestChat(p.get('id'), p.get('token'))
  if (!chat) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const { data } = await createAdminClient().from('concierge_messages').select('id, sender, text, created_at')
    .eq('chat_id', chat.id).gt('id', Number(p.get('after') ?? 0)).order('id')
  return NextResponse.json({ messages: data ?? [], lang: chat.lang, human: chat.human })
}
