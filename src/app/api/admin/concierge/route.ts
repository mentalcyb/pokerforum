import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/adminAuth'
import { ownerFromRequest } from '@/lib/ownerAuth'
import { translate } from '@/lib/concierge'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const maxDuration = 30

async function allowed(req: NextRequest) {
  return (await ownerFromRequest(req)) !== null || (await isAdminRequest(req))
}

/** Team: list chats, or one chat's messages (?chat=), or the bot's knowledge (?knowledge=1). */
export async function GET(req: NextRequest) {
  if (!(await allowed(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const p = req.nextUrl.searchParams
  if (p.get('count')) {
    const { count } = await admin.from('concierge_chats').select('id', { count: 'exact', head: true }).eq('unread', true).neq('status', 'new').neq('status', 'done')
    return NextResponse.json({ unread: count ?? 0 })
  }
  if (p.get('knowledge')) {
    const { data } = await admin.from('concierge_settings').select('knowledge').eq('id', 1).maybeSingle()
    return NextResponse.json({ knowledge: data?.knowledge ?? '' })
  }
  const chatId = p.get('chat')
  if (chatId) {
    const { data: messages } = await admin.from('concierge_messages').select('id, sender, text, text_ka, created_at').eq('chat_id', chatId).order('id')
    await admin.from('concierge_chats').update({ unread: false }).eq('id', chatId)
    return NextResponse.json({ messages: messages ?? [] })
  }
  const { data, error } = await admin.from('concierge_chats')
    .select('id, lang, status, human, summary_ka, unread, created_at, updated_at').neq('status', 'new')
    .order('updated_at', { ascending: false }).limit(100)
  if (error) return NextResponse.json({ error: 'missing_table' })
  return NextResponse.json({ chats: data ?? [] })
}

/**
 * Team actions:
 *  { action: 'reply', chat, text }  → translated into the visitor's language; the bot stops answering
 *  { action: 'bot', chat, on }      → hand the chat back to the bot (on: true) or take it over
 *  { action: 'status', chat, status }
 *  { action: 'knowledge', text }
 */
export async function POST(req: NextRequest) {
  if (!(await allowed(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const admin = createAdminClient()
  const body = await req.json().catch(() => ({}))
  if (body.action === 'knowledge') {
    const { error } = await admin.from('concierge_settings').upsert({ id: 1, knowledge: String(body.text ?? '').slice(0, 20000), updated_at: new Date().toISOString() })
    return NextResponse.json(error ? { error: error.message } : { ok: true })
  }
  const { data: chat } = await admin.from('concierge_chats').select('id, lang').eq('id', String(body.chat ?? '')).maybeSingle()
  if (!chat) return NextResponse.json({ error: 'not found' }, { status: 404 })
  if (body.action === 'reply') {
    const text = String(body.text ?? '').trim().slice(0, 2000)
    if (!text) return NextResponse.json({ error: 'empty' }, { status: 400 })
    const forGuest = chat.lang === 'ka' ? text : await translate(text, chat.lang)
    await admin.from('concierge_messages').insert({ chat_id: chat.id, sender: 'team', text: forGuest, text_ka: text })
    await admin.from('concierge_chats').update({ human: true, unread: false, updated_at: new Date().toISOString() }).eq('id', chat.id)
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'bot') {
    await admin.from('concierge_chats').update({ human: !body.on }).eq('id', chat.id)
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'status' && ['active', 'done'].includes(body.status)) {
    await admin.from('concierge_chats').update({ status: body.status, unread: false }).eq('id', chat.id)
    return NextResponse.json({ ok: true })
  }
  if (body.action === 'delete') {
    await admin.from('concierge_chats').delete().eq('id', chat.id)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'bad request' }, { status: 400 })
}
