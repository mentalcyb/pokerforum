// Daily poker news: fetch RSS from a few trusted sites, summarize new stories in
// Georgian (and English) with an AI model, store them in news_items.
// Server-only (uses the service-role key and the OpenRouter key).
import { createAdminClient } from '@/lib/supabase-admin'

export type NewsItem = {
  id: number
  source: string
  source_url: string
  title_en: string
  title_ka: string
  summary_ka: string
  summary_en: string
  published_at: string
}

/** Feeds verified to be valid RSS with fresh poker news. */
export const NEWS_SOURCES = [
  { name: 'PokerNews', url: 'https://www.pokernews.com/rss.php' },
  { name: 'Pokerology', url: 'https://www.pokerology.com/feed/' },
  { name: 'PokerTube', url: 'https://www.pokertube.com/feed/' },
] as const

const MAX_NEW_PER_RUN = 8
const MAX_AGE_HOURS = 72
// Good Georgian at low cost; override with the NEWS_MODEL env variable if needed.
const DEFAULT_MODEL = 'google/gemini-2.5-flash'

type FeedItem = { source: string; title: string; link: string; description: string; published: Date }

// ── RSS parsing (small and dependency-free; feeds are plain RSS 2.0) ─────────

function decodeEntities(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#039;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function stripHtml(s: string): string {
  return decodeEntities(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))
  return m ? m[1] : ''
}

export function parseRss(xml: string, source: string): FeedItem[] {
  const items: FeedItem[] = []
  for (const m of Array.from(xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi))) {
    const raw = m[0]
    const title = stripHtml(tag(raw, 'title'))
    const link = decodeEntities(tag(raw, 'link')).trim()
    const published = new Date(decodeEntities(tag(raw, 'pubDate')).trim())
    const description = stripHtml(tag(raw, 'description') || tag(raw, 'content:encoded')).slice(0, 700)
    if (!title || !/^https?:\/\//.test(link) || isNaN(published.getTime())) continue
    items.push({ source, title, link, description, published })
  }
  return items
}

async function fetchFeed(src: { name: string; url: string }): Promise<FeedItem[]> {
  try {
    const res = await fetch(src.url, {
      headers: { 'User-Agent': 'pokerforum.ge news bot (+https://pokerforum.ge/news)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return parseRss(await res.text(), src.name)
  } catch (e) {
    console.warn(`[news] feed ${src.name} failed:`, e)
    return []
  }
}

// ── AI summaries ───────────────────────────────────────────────────────────

type Summary = { i: number; relevant: boolean; duplicate_of: number | null; title_ka: string; summary_ka: string; summary_en: string }

const SYSTEM_PROMPT = `You write short poker news for pokerforum.ge, a Georgian poker community.
For each story you receive (headline + teaser), write:
- "title_ka": a natural Georgian headline (not a word-for-word translation), max ~90 characters
- "summary_ka": 2–3 sentences in fluent, correct Georgian, based ONLY on the given text. Never invent facts, numbers or quotes.
- "summary_en": the same summary in English, 1–2 sentences
- "relevant": false if the story is not about poker (e.g. other sports, general gambling regulation unrelated to poker) or is pure advertising
- "duplicate_of": the index of an earlier story in this batch about the same event, otherwise null

Georgian style rules:
- Keep player names, tournament names and brands in Latin script exactly as given (e.g. "Adrian Mateos", "WSOP", "EPT Prague").
- Keep money amounts and currencies as given (e.g. $229,500, €5,300).
- Poker terms: buy-in = ბაი-ინი; main event = მთავარი ტურნირი; final table = ფინალური მაგიდა; prize pool = საპრიზო ფონდი;
  guarantee = გარანტია; field / entries = მონაწილეები; chip leader = ჩიპ-ლიდერი; high roller = ჰაი-როლერი;
  bracelet = სამაჯური; heads-up = ჰედზ-აპი; series/festival = სერია/ფესტივალი; online = ონლაინ; live = ცოცხალი (ლაივ).
- Neutral, news style. No emojis, no hype.

Reply with ONLY a JSON array, one object per story, each with the keys: i, relevant, duplicate_of, title_ka, summary_ka, summary_en.`

async function summarize(items: FeedItem[]): Promise<Summary[]> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY is not set')
  const list = items.map((it, i) => `[${i}] ${it.title}\n${it.description}`).join('\n\n')
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://pokerforum.ge',
      'X-Title': 'pokerforum.ge news',
    },
    body: JSON.stringify({
      model: process.env.NEWS_MODEL || DEFAULT_MODEL,
      temperature: 0.3,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: list },
      ],
    }),
    signal: AbortSignal.timeout(45000),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`)
  const content: string = JSON.parse(text).choices?.[0]?.message?.content ?? ''
  const json = content.match(/\[[\s\S]*\]/)
  if (!json) throw new Error('AI reply had no JSON array')
  const parsed = JSON.parse(json[0]) as Summary[]
  return parsed.filter(s =>
    typeof s.i === 'number' && s.i >= 0 && s.i < items.length &&
    typeof s.title_ka === 'string' && s.title_ka.trim() &&
    typeof s.summary_ka === 'string' && s.summary_ka.trim(),
  )
}

// ── one run ────────────────────────────────────────────────────────────────

export type NewsRunResult = { fetched: number; candidates: number; added: number; skipped: number; error?: string }

export async function updateNews(now = new Date()): Promise<NewsRunResult> {
  const admin = createAdminClient()
  const all = (await Promise.all(NEWS_SOURCES.map(fetchFeed))).flat()
  const cutoff = now.getTime() - MAX_AGE_HOURS * 3600_000
  const fresh = all.filter(it => it.published.getTime() >= cutoff && it.published.getTime() <= now.getTime() + 3600_000)

  // skip stories we already have
  const links = Array.from(new Set(fresh.map(it => it.link)))
  const { data: existing, error: exErr } = await admin.from('news_items').select('source_url').in('source_url', links.length ? links : ['-'])
  if (exErr) return { fetched: all.length, candidates: 0, added: 0, skipped: 0, error: exErr.message }
  const known = new Set((existing ?? []).map((r: { source_url: string }) => r.source_url))
  const candidates = fresh
    .filter((it, i, arr) => !known.has(it.link) && arr.findIndex(x => x.link === it.link) === i)
    .sort((a, b) => b.published.getTime() - a.published.getTime())
    .slice(0, MAX_NEW_PER_RUN)
    .reverse() // oldest first, so duplicate_of points to the earlier story

  if (candidates.length === 0) return { fetched: all.length, candidates: 0, added: 0, skipped: 0 }

  let summaries: Summary[]
  try {
    summaries = await summarize(candidates)
  } catch (e) {
    return { fetched: all.length, candidates: candidates.length, added: 0, skipped: 0, error: String(e) }
  }

  const rows = summaries
    .filter(s => s.relevant !== false && (s.duplicate_of === null || s.duplicate_of === undefined))
    .map(s => {
      const it = candidates[s.i]
      return {
        source: it.source,
        source_url: it.link,
        title_en: it.title.slice(0, 300),
        title_ka: s.title_ka.trim().slice(0, 300),
        summary_ka: s.summary_ka.trim().slice(0, 1200),
        summary_en: (s.summary_en || it.description).trim().slice(0, 800),
        published_at: it.published.toISOString(),
      }
    })

  if (rows.length) {
    const { error } = await admin.from('news_items').upsert(rows, { onConflict: 'source_url', ignoreDuplicates: true })
    if (error) return { fetched: all.length, candidates: candidates.length, added: 0, skipped: 0, error: error.message }
  }
  return { fetched: all.length, candidates: candidates.length, added: rows.length, skipped: candidates.length - rows.length }
}
