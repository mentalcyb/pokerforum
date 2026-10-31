'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

type Chat = { id: string; lang: string; status: string; human: boolean; summary_ka: string | null; unread: boolean; updated_at: string }
type Msg = { id: number; sender: 'guest' | 'bot' | 'team'; text: string; text_ka: string | null; created_at: string }
const LANG_NAME: Record<string, string> = { en: 'English', ru: 'Русский', tr: 'Türkçe', he: 'עברית', ar: 'العربية', fa: 'فارسی', uk: 'Українська', de: 'Deutsch', ka: 'ქართული' }

/** Admin panel: visitors' concierge chats. Read in Georgian, answer in Georgian — it's translated for the visitor. */
export default function AdminConcierge() {
  const [chats, setChats] = useState<Chat[]>([])
  const [sel, setSel] = useState<Chat | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [knowledge, setKnowledge] = useState<string | null>(null)
  const [kSaved, setKSaved] = useState(false)
  const [missing, setMissing] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  async function api(method: 'GET' | 'POST', query = '', body?: object) {
    const { data } = await createClient().auth.getSession()
    const res = await fetch(`/api/admin/concierge${query}`, {
      method, cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.json().catch(() => ({}))
  }

  async function loadChats() {
    const j = await api('GET')
    if (j.error === 'missing_table') setMissing(true)
    else setChats(j.chats ?? [])
  }
  async function loadMsgs(c: Chat) { setMsgs((await api('GET', `?chat=${c.id}`)).messages ?? []) }

  useEffect(() => { loadChats(); const id = setInterval(loadChats, 10000); return () => clearInterval(id) }, [])
  useEffect(() => {
    if (!sel) return
    loadMsgs(sel)
    const id = setInterval(() => loadMsgs(sel), 4000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs.length])

  async function send() {
    if (!sel || !reply.trim()) return
    setBusy(true)
    await api('POST', '', { action: 'reply', chat: sel.id, text: reply.trim() })
    setReply(''); setSel({ ...sel, human: true }); await loadMsgs(sel); setBusy(false)
  }
  async function setBot(on: boolean) { if (!sel) return; await api('POST', '', { action: 'bot', chat: sel.id, on }); setSel({ ...sel, human: !on }); loadChats() }
  async function setDone() { if (!sel) return; await api('POST', '', { action: 'status', chat: sel.id, status: 'done' }); setSel({ ...sel, status: 'done' }); loadChats() }
  async function openKnowledge() { setKnowledge((await api('GET', '?knowledge=1')).knowledge ?? '') }
  async function saveKnowledge() { await api('POST', '', { action: 'knowledge', text: knowledge }); setKSaved(true); setTimeout(() => setKSaved(false), 2000) }

  if (missing) return <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 text-sm text-amber-800 dark:text-amber-300">ჩატისთვის გაუშვით supabase/concierge.sql Supabase-ის SQL Editor-ში.</div>

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
        {knowledge === null ? (
          <button onClick={openKnowledge} className="text-sm font-medium text-brand-600 hover:underline">🧠 ბოტის ცოდნა (სერიები, ადგილები, ფასები) — რედაქტირება</button>
        ) : (
          <div>
            <div className="font-semibold text-sm text-gray-900 dark:text-white mb-1">🧠 ბოტის ცოდნა</div>
            <p className="text-xs text-gray-500 mb-2">ჩაწერე ყველაფერი, რაც ბოტმა უნდა იცოდეს: თბილისისა და ბათუმის სერიები (სახელი, თარიღები, buy-in, კაზინო), რეკომენდებული უბნები, ფასების დიაპაზონი, ტრანსფერი. ბოტი სხვა ფაქტებს არ მოიგონებს. შეიძლება ქართულად ან ინგლისურად.</p>
            <textarea value={knowledge} onChange={e => setKnowledge(e.target.value)} rows={10}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white font-mono" />
            <div className="mt-2 flex gap-2">
              <button onClick={saveKnowledge} className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold">{kSaved ? '✓ შენახულია' : 'შენახვა'}</button>
              <button onClick={() => setKnowledge(null)} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm">დახურვა</button>
            </div>
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-[280px_1fr] gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden max-h-[600px] overflow-y-auto">
          {chats.length === 0 && <div className="p-6 text-center text-sm text-gray-400">ჯერ ჩატები არ არის.</div>}
          {chats.map(c => (
            <button key={c.id} onClick={() => setSel(c)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 ${sel?.id === c.id ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}>
              <div className="flex items-center gap-2 text-xs">
                {c.unread && <span className="w-2 h-2 rounded-full bg-red-500" />}
                <span className="font-semibold text-gray-900 dark:text-white">{LANG_NAME[c.lang] ?? c.lang}</span>
                <span className="text-gray-400">{new Date(c.updated_at).toLocaleString()}</span>
                {c.status === 'done' && <span className="ml-auto text-green-600">✓</span>}
                {c.human && c.status !== 'done' && <span className="ml-auto text-amber-600">👤</span>}
              </div>
              <div className="text-xs text-gray-500 mt-1 line-clamp-2">{c.summary_ka ?? '…'}</div>
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 flex flex-col min-h-[400px] max-h-[600px]">
          {!sel ? (
            <div className="m-auto text-sm text-gray-400">აირჩიე ჩატი მარცხნივ</div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-gray-900 dark:text-white">{LANG_NAME[sel.lang]}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${sel.human ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{sel.human ? '👤 შენ პასუხობ' : '🤖 ბოტი პასუხობს'}</span>
                <button onClick={() => setBot(sel.human)} className="ml-auto text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700">{sel.human ? '🤖 ბოტს დავუბრუნოთ' : '👤 მე ვუპასუხებ'}</button>
                {sel.status !== 'done' && <button onClick={setDone} className="text-xs px-2.5 py-1 rounded-lg border border-green-300 text-green-700">✓ დასრულდა</button>}
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50 dark:bg-gray-950">
                {msgs.map(m => (
                  <div key={m.id} className={`flex ${m.sender === 'guest' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${m.sender === 'guest' ? 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700' : m.sender === 'team' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-brand-50 dark:bg-brand-900/20'}`}>
                      <div className="text-[10px] font-semibold text-gray-400 mb-0.5">{m.sender === 'guest' ? 'სტუმარი' : m.sender === 'team' ? 'შენ' : 'ბოტი'}</div>
                      <div className="text-gray-900 dark:text-white whitespace-pre-wrap">{m.text_ka || m.text}</div>
                      {m.text_ka && m.text_ka !== m.text && <div className="mt-1 text-[11px] text-gray-400 whitespace-pre-wrap">{m.text}</div>}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="p-2 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                <input value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder={`დაწერე ქართულად — ავტომატურად ითარგმნება: ${LANG_NAME[sel.lang]}`}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white" />
                <button onClick={send} disabled={busy || !reply.trim()} className="px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-50">გაგზავნა</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
