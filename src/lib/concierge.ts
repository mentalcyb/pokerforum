import { createAdminClient } from '@/lib/supabase-admin'

/** Languages a visitor can pick. Names are shown in their own language. */
export const CONCIERGE_LANGS: Record<string, string> = {
  en: 'English', ru: 'Русский', tr: 'Türkçe', he: 'עברית', ar: 'العربية',
  fa: 'فارسی', uk: 'Українська', de: 'Deutsch', ka: 'ქართული',
}

export type ConciergeMessage = { id: number; sender: 'guest' | 'bot' | 'team'; text: string; text_ka: string | null; created_at: string }

async function ai(messages: { role: string; content: string }[], json: boolean, timeoutMs = 25000): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY?.trim()
  if (!key) throw new Error('OPENROUTER_API_KEY is not set')
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://pokerforum.ge', 'X-Title': 'pokerforum.ge concierge' },
    body: JSON.stringify({
      model: process.env.CONCIERGE_MODEL || process.env.NEWS_MODEL || 'google/gemini-2.5-flash',
      temperature: 0.4,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      messages,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`)
  return JSON.parse(text).choices?.[0]?.message?.content ?? ''
}

function parseJson(s: string): Record<string, unknown> {
  try { return JSON.parse(s) } catch {}
  const m = s.match(/\{[\s\S]*\}/)
  try { return m ? JSON.parse(m[0]) : {} } catch { return {} }
}

/** Plain translation (used for the team's replies and when the bot is off). */
export async function translate(text: string, toLang: string): Promise<string> {
  const target = toLang === 'ka' ? 'Georgian' : CONCIERGE_LANGS[toLang] ?? 'English'
  try {
    const out = await ai([
      { role: 'system', content: `Translate the user's message into ${target}. Keep names, numbers, prices, dates and links exactly. Reply with the translation only.` },
      { role: 'user', content: text },
    ], false, 15000)
    return out.trim() || text
  } catch { return text }
}

const SYSTEM = (lang: string, knowledge: string) => `You are the concierge of pokerforum.ge, a Georgian poker community that helps foreign players come to poker series in Georgia — ONLY in Tbilisi and Batumi.
Our service (say it warmly when relevant): we talk to the landlord/hotel for the guest, find accommodation at the best price near the poker room, show the way from the accommodation to the poker room, and help with anything on the trip (airport transfer, SIM card, currency, restaurants).
Write ONLY in ${CONCIERGE_LANGS[lang] ?? 'English'}. Be friendly, short (2–5 sentences), practical. No markdown headings.

Your job:
1. Answer questions using ONLY the facts below and well-known general facts about Georgia (currency GEL, airports Tbilisi TBS and Batumi BUS, many nationalities can visit visa-free — tell them to check their own case). Never invent tournament dates, buy-ins, prices or venues. If you don't know, say a team member will confirm.
2. For a booking, collect step by step: which series/dates, number of people, arrival and departure dates, accommodation wishes and budget, and a contact (WhatsApp, Telegram or e-mail) with their name. When you have them, confirm and say a team member will contact them shortly.
3. Never ask for payment details, passwords or passport numbers. We don't take payments in this chat.

FACTS FROM THE TEAM (may be empty):
${knowledge || '(no details entered yet — say the team will confirm specifics)'}`

/** Bot answer to the visitor + Georgian translations for the team, in one call. */
export async function botReply(lang: string, history: ConciergeMessage[], knowledge: string): Promise<{ reply: string; reply_ka: string; guest_ka: string; summary_ka: string }> {
  const msgs = history.slice(-20).map(m => ({ role: m.sender === 'guest' ? 'user' : 'assistant', content: m.text }))
  const raw = await ai([
    { role: 'system', content: SYSTEM(lang, knowledge) + `

Respond as JSON: {"reply": "<your answer to the visitor, in their language>", "reply_ka": "<the same answer in Georgian>", "guest_ka": "<the visitor's LAST message translated to Georgian>", "summary_ka": "<1-2 lines in Georgian: what this visitor wants so far (series, dates, people, budget, contact)>"}` },
    ...msgs,
  ], true)
  const j = parseJson(raw)
  const s = (k: string) => (typeof j[k] === 'string' ? (j[k] as string).trim() : '')
  return { reply: s('reply') || '…', reply_ka: s('reply_ka'), guest_ka: s('guest_ka'), summary_ka: s('summary_ka') }
}

/** First message in the chosen language. */
export const WELCOME: Record<string, string> = {
  en: "Hi! 👋 Coming to a poker series in Tbilisi or Batumi? We'll talk to the landlord for you, find the best price, and show you the way from your place to the poker room. Tell me which series and dates you're planning!",
  ru: 'Привет! 👋 Едете на покерную серию в Тбилиси или Батуми? Мы сами поговорим с арендодателем, найдём лучшую цену и покажем дорогу от жилья до покер-рума. Расскажите, на какую серию и на какие даты планируете!',
  tr: 'Merhaba! 👋 Tiflis veya Batum’daki bir poker serisine mi geliyorsunuz? Ev sahibiyle sizin yerinize konuşur, en iyi fiyatı bulur ve konaklamanızdan poker salonuna yolu gösteririz. Hangi seri ve tarihleri planlıyorsunuz?',
  he: 'שלום! 👋 מגיעים לסדרת פוקר בטביליסי או בבטומי? נדבר עם המשכיר במקומכם, נמצא את המחיר הטוב ביותר ונראה לכם את הדרך מהמקום שלכם לחדר הפוקר. לאיזו סדרה ובאילו תאריכים אתם מתכננים?',
  ar: 'مرحباً! 👋 قادم إلى سلسلة بوكر في تبليسي أو باتومي؟ سنتحدث مع المؤجّر نيابةً عنك، ونجد أفضل سعر، ونريك الطريق من مكان إقامتك إلى صالة البوكر. أخبرنا بالسلسلة والتواريخ!',
  fa: 'سلام! 👋 برای یک سری پوکر به تفلیس یا باتومی می‌آیید؟ ما به جای شما با صاحبخانه صحبت می‌کنیم، بهترین قیمت را پیدا می‌کنیم و مسیر محل اقامت تا سالن پوکر را نشانتان می‌دهیم. بگویید کدام سری و چه تاریخی؟',
  uk: 'Привіт! 👋 Їдете на покерну серію в Тбілісі чи Батумі? Ми самі поговоримо з орендодавцем, знайдемо найкращу ціну й покажемо дорогу від житла до покер-руму. Розкажіть, яку серію та дати плануєте!',
  de: 'Hallo! 👋 Du kommst zu einer Poker-Serie in Tiflis oder Batumi? Wir sprechen für dich mit dem Vermieter, finden den besten Preis und zeigen dir den Weg von der Unterkunft zum Pokerraum. Welche Serie und welche Daten planst du?',
  ka: 'გამარჯობა! 👋 თბილისში ან ბათუმში პოკერის სერიაზე მოდიხარ? ჩვენ დაველაპარაკებით გამქირავებელს შენ მაგივრად, მოგიძებნით საუკეთესო ფასს და გაჩვენებთ გზას სახლიდან პოკერ რუმამდე. მითხარი, რომელ სერიაზე და რა თარიღებში გეგმავ!',
}

/** Optional instant notification to the team (set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID in Vercel). */
export async function notifyTeam(text: string) {
  const bot = process.env.TELEGRAM_BOT_TOKEN?.trim(), chat = process.env.TELEGRAM_CHAT_ID?.trim()
  if (!bot || !chat) return
  try {
    await fetch(`https://api.telegram.org/bot${bot}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(5000),
    })
  } catch {}
}

export async function getKnowledge(): Promise<string> {
  const { data } = await createAdminClient().from('concierge_settings').select('knowledge').eq('id', 1).maybeSingle()
  return data?.knowledge ?? ''
}

/** The visitor's chat, if the token matches. */
export async function guestChat(id: unknown, token: unknown) {
  if (typeof id !== 'string' || typeof token !== 'string') return null
  const { data } = await createAdminClient().from('concierge_chats').select('*').eq('id', id).maybeSingle()
  return data && data.token === token ? data : null
}
