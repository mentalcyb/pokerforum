'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

/** Visitor concierge chat: poker trips to Tbilisi / Batumi. Bot first, the team can join any time. */
const LANGS: [string, string][] = [
  ['en', 'English'], ['ru', 'Русский'], ['tr', 'Türkçe'], ['he', 'עברית'], ['ar', 'العربية'],
  ['fa', 'فارسی'], ['uk', 'Українська'], ['de', 'Deutsch'], ['ka', 'ქართული'],
]
const RTL = new Set(['he', 'ar', 'fa'])
const UI: Record<string, { promises: [string, string, string]; placeholder: string; send: string; team: string; title: string }> = {
  en: { title: 'Poker trip to Georgia', promises: ['We talk to the landlord for you', 'We show you the way from your place to the poker room', 'We find you the best price'], placeholder: 'Type a message…', send: 'Send', team: 'Team' },
  ru: { title: 'Покерная поездка в Грузию', promises: ['Сами поговорим с арендодателем', 'Покажем дорогу от жилья до покер-рума', 'Найдём лучшую цену'], placeholder: 'Напишите сообщение…', send: 'Отправить', team: 'Команда' },
  tr: { title: 'Gürcistan’a poker gezisi', promises: ['Ev sahibiyle sizin yerinize konuşuruz', 'Konaklamanızdan poker salonuna yolu gösteririz', 'En iyi fiyatı buluruz'], placeholder: 'Mesaj yazın…', send: 'Gönder', team: 'Ekip' },
  he: { title: 'טיול פוקר לגאורגיה', promises: ['נדבר עם המשכיר במקומכם', 'נראה לכם את הדרך לחדר הפוקר', 'נמצא לכם את המחיר הטוב ביותר'], placeholder: 'כתבו הודעה…', send: 'שלח', team: 'צוות' },
  ar: { title: 'رحلة بوكر إلى جورجيا', promises: ['نتحدث مع المؤجّر نيابةً عنك', 'نريك الطريق إلى صالة البوكر', 'نجد لك أفضل سعر'], placeholder: 'اكتب رسالة…', send: 'إرسال', team: 'الفريق' },
  fa: { title: 'سفر پوکر به گرجستان', promises: ['به جای شما با صاحبخانه صحبت می‌کنیم', 'مسیر تا سالن پوکر را نشانتان می‌دهیم', 'بهترین قیمت را پیدا می‌کنیم'], placeholder: 'پیام بنویسید…', send: 'ارسال', team: 'تیم' },
  uk: { title: 'Покерна поїздка до Грузії', promises: ['Самі поговоримо з орендодавцем', 'Покажемо дорогу від житла до покер-руму', 'Знайдемо найкращу ціну'], placeholder: 'Напишіть повідомлення…', send: 'Надіслати', team: 'Команда' },
  de: { title: 'Pokerreise nach Georgien', promises: ['Wir sprechen für dich mit dem Vermieter', 'Wir zeigen dir den Weg zum Pokerraum', 'Wir finden den besten Preis'], placeholder: 'Nachricht schreiben…', send: 'Senden', team: 'Team' },
  ka: { title: 'პოკერ ტური საქართველოში', promises: ['დაველაპარაკებით გამქირავებელს თქვენს მაგივრად', 'გაჩვენებთ გზას სახლიდან პოკერ რუმამდე', 'ვეცდებით მოგიძებნოთ საუკეთესო ფასად'], placeholder: 'დაწერე შეტყობინება…', send: 'გაგზავნა', team: 'გუნდი' },
}
const STORE = 'pf-concierge'
const HIDDEN = [/^\/admin/, /^\/home-games\/.+/]

type Msg = { id: number; sender: 'guest' | 'bot' | 'team'; text: string }
type Session = { id: string; token: string; lang: string }

export default function ConciergeWidget() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [typing, setTyping] = useState(false)
  const [error, setError] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const lastId = useRef(0)
  const polling = useRef(false)

  useEffect(() => {
    try { const s = localStorage.getItem(STORE); if (s) setSession(JSON.parse(s)) } catch {}
  }, [])

  async function poll(s: Session) {
    // one request at a time: the timer and a just-sent message could otherwise fetch the same messages twice
    if (polling.current) return
    polling.current = true
    try {
      const res = await fetch(`/api/concierge/poll?id=${s.id}&token=${encodeURIComponent(s.token)}&after=${lastId.current}`, { cache: 'no-store' })
      if (res.status === 404) { try { localStorage.removeItem(STORE) } catch {}; setSession(null); setMsgs([]); lastId.current = 0; return }
      const j = await res.json()
      if (j.messages?.length) {
        lastId.current = Math.max(lastId.current, j.messages[j.messages.length - 1].id)
        setMsgs(m => {
          const seen = new Set(m.map(x => x.id))
          return [...m, ...j.messages.filter((x: Msg) => !seen.has(x.id))]
        })
        if (j.messages.some((m: Msg) => m.sender !== 'guest')) setTyping(false)
      }
    } catch {} finally { polling.current = false }
  }

  useEffect(() => {
    if (!open || !session) return
    poll(session)
    const id = setInterval(() => poll(session), 3000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs, typing])

  async function start(lang: string) {
    setBusy(true); setError(false)
    try {
      const res = await fetch('/api/concierge/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang }) })
      if (!res.ok) throw new Error()
      const s: Session = { ...(await res.json()), lang }
      try { localStorage.setItem(STORE, JSON.stringify(s)) } catch {}
      lastId.current = 0; setMsgs([]); setSession(s)
    } catch { setError(true) } finally { setBusy(false) }
  }

  async function send() {
    const body = text.trim()
    if (!body || !session || busy) return
    setText(''); setBusy(true); setTyping(true)
    setMsgs(m => [...m, { id: -Date.now(), sender: 'guest', text: body }])
    try {
      await fetch('/api/concierge/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: session.id, token: session.token, text: body }) })
      // drop the local echo; the server copy arrives with the next poll
      setMsgs(m => m.filter(x => x.id > 0))
      for (let i = 0; i < 20 && polling.current; i++) await new Promise(r => setTimeout(r, 100))
      await poll(session)
    } catch { setTyping(false) } finally { setBusy(false) }
  }

  if (HIDDEN.some(re => re.test(pathname || ''))) return null
  const ui = UI[session?.lang ?? 'en']
  const rtl = session ? RTL.has(session.lang) : false

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-40 flex items-center gap-2 pl-3 pr-4 py-3 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-xl text-sm font-semibold">
          <span className="text-lg">✈️</span><span className="hidden sm:inline">{UI.en.title}</span>
        </button>
      )}
      {open && (
        <div className="fixed z-50 inset-x-2 bottom-2 sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-[380px] h-[min(600px,calc(100dvh-16px))] flex flex-col rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl">
          <div className="px-4 py-3 bg-brand-600 text-white">
            <div className="flex items-center gap-2">
              <span className="text-lg">✈️</span>
              <div className="flex-1 font-semibold">{ui.title}</div>
              {session && (
                <button onClick={() => { try { localStorage.removeItem(STORE) } catch {}; setSession(null); setMsgs([]); lastId.current = 0 }}
                  className="text-xs px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25" title="Language">🌐</button>
              )}
              <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-full hover:bg-white/20" aria-label="close">✕</button>
            </div>
            <ul className="mt-2 space-y-0.5 text-xs text-white/90" dir={rtl ? 'rtl' : 'ltr'}>
              {ui.promises.map((p, i) => <li key={i}>{['🗣️', '🗺️', '💰'][i]} {p}</li>)}
            </ul>
          </div>

          {!session ? (
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">Choose your language · Выберите язык · Dilinizi seçin</p>
              <div className="grid grid-cols-3 gap-2">
                {LANGS.map(([code, name]) => (
                  <button key={code} onClick={() => start(code)} disabled={busy}
                    className="py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200 hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 disabled:opacity-50">
                    {name}
                  </button>
                ))}
              </div>
              {error && <p className="mt-3 text-xs text-red-500">Chat is temporarily unavailable. Please try again later.</p>}
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50 dark:bg-gray-950" dir={rtl ? 'rtl' : 'ltr'}>
                {msgs.map(m => (
                  <div key={m.id} className={`flex ${m.sender === 'guest' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words ${m.sender === 'guest' ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-bl-sm'}`}>
                      {m.sender === 'team' && <div className="text-[10px] font-semibold text-amber-600 mb-0.5">👤 {ui.team}</div>}
                      {m.text}
                    </div>
                  </div>
                ))}
                {typing && <div className="text-xs text-gray-400 px-2">…</div>}
                <div ref={endRef} />
              </div>
              <div className="p-2 border-t border-gray-100 dark:border-gray-800 flex gap-2">
                <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} dir={rtl ? 'rtl' : 'ltr'}
                  placeholder={ui.placeholder} maxLength={1500}
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                <button onClick={send} disabled={busy || !text.trim()} className="px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-50">{ui.send}</button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
