import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { botReply, translate, getKnowledge, guestChat, notifyTeam, CONCIERGE_LANGS, type ConciergeMessage } from '@/lib/concierge'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/** Visitor sends a message: { id, token, text }. The bot answers unless a team member has taken over. */
export async function POST(req: NextRequest) {
  const { id, token, text } = await req.json().catch(() => ({}))
  const chat = await guestChat(id, token)
  if (!chat) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const msg = String(text ?? '').trim().slice(0, 1500)
  if (!msg) return NextResponse.json({ error: 'empty' }, { status: 400 })
  const admin = createAdminClient()

  // basic flood protection
  const { count } = await admin.from('concierge_messages').select('id', { count: 'exact', head: true })
    .eq('chat_id', chat.id).eq('sender', 'guest').gte('created_at', new Date(Date.now() - 60_000).toISOString())
  if ((count ?? 0) >= 10) return NextResponse.json({ error: 'slow down' }, { status: 429 })

  const { data: saved } = await admin.from('concierge_messages').insert({ chat_id: chat.id, sender: 'guest', text: msg }).select('id').single()
  const isFirst = chat.status === 'new'
  await admin.from('concierge_chats').update({ status: chat.status === 'done' ? 'active' : chat.status === 'new' ? 'active' : chat.status, unread: true, updated_at: new Date().toISOString() }).eq('id', chat.id)

  if (chat.human) {
    // a person is answering: just translate for them
    const ka = chat.lang === 'ka' ? msg : await translate(msg, 'ka')
    if (saved) await admin.from('concierge_messages').update({ text_ka: ka }).eq('id', saved.id)
    await notifyTeam(`💬 ${CONCIERGE_LANGS[chat.lang]} სტუმარი: ${ka}\nhttps://pokerforum.ge/admin`)
    return NextResponse.json({ ok: true })
  }

  const { data: history } = await admin.from('concierge_messages').select('id, sender, text, text_ka, created_at').eq('chat_id', chat.id).order('id')
  try {
    const r = await botReply(chat.lang, (history ?? []) as ConciergeMessage[], await getKnowledge())
    if (saved && r.guest_ka) await admin.from('concierge_messages').update({ text_ka: r.guest_ka }).eq('id', saved.id)
    await admin.from('concierge_messages').insert({ chat_id: chat.id, sender: 'bot', text: r.reply, text_ka: r.reply_ka || null })
    if (r.summary_ka) await admin.from('concierge_chats').update({ summary_ka: r.summary_ka.slice(0, 500) }).eq('id', chat.id)
    if (isFirst) await notifyTeam(`🆕 ახალი სტუმარი (${CONCIERGE_LANGS[chat.lang]}): ${r.guest_ka || msg}\nhttps://pokerforum.ge/admin`)
  } catch (e) {
    console.warn('[concierge]', e)
    await admin.from('concierge_chats').update({ human: true }).eq('id', chat.id)
    await notifyTeam(`⚠️ ბოტმა ვერ უპასუხა სტუმარს (${CONCIERGE_LANGS[chat.lang]}) — გთხოვთ ჩაერთოთ: https://pokerforum.ge/admin`)
  }
  return NextResponse.json({ ok: true })
}
