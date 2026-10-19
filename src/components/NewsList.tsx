'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import { createClient } from '@/lib/supabase'
import type { NewsItem } from '@/lib/news'

const SOURCE_COLORS: Record<string, string> = {
  PokerNews: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  Pokerology: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  PokerTube: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
}

export function newsDate(iso: string, lang: 'ka' | 'en', months: string[]): string {
  const d = new Date(iso)
  const now = Date.now()
  const hours = Math.floor((now - d.getTime()) / 3600_000)
  if (hours < 1) return lang === 'ka' ? 'ახლახან' : 'just now'
  if (hours < 24) return lang === 'ka' ? `${hours} სთ წინ` : `${hours}h ago`
  return `${d.getDate()} ${months[d.getMonth()]}`
}

export function discussHref(item: NewsItem, lang: 'ka' | 'en'): string {
  const title = lang === 'ka' ? item.title_ka : item.title_en
  return `/new-post?title=${encodeURIComponent(title)}&ref=${encodeURIComponent(item.source_url)}`
}

/** Full news list (the /news page). Server renders Georgian; English follows the site language. */
export default function NewsList({ items }: { items: NewsItem[] }) {
  const { t, lang } = useApp()
  const [list, setList] = useState(items)
  const [token, setToken] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session
      if (!session) return
      setToken(session.access_token)
      const { data: p } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
      setIsAdmin(!!p?.is_admin)
    })
  }, [])

  async function refresh() {
    if (!token) return
    setRefreshing(true)
    setMessage(null)
    try {
      const res = await fetch('/api/cron/news', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json()
      setMessage(json.error ? `⚠️ ${json.error}` : t.newsRefreshResult(json.added ?? 0))
      if (json.added > 0) setTimeout(() => window.location.reload(), 1200)
    } catch {
      setMessage(t.networkError)
    } finally {
      setRefreshing(false)
    }
  }

  async function hide(id: number) {
    if (!token || !confirm(t.newsConfirmHide)) return
    const res = await fetch('/api/news/hide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setList(l => l.filter(i => i.id !== id))
  }

  return (
    <div>
      {isAdmin && (
        <div className="mb-4 flex flex-wrap items-center gap-3 p-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10">
          <button onClick={refresh} disabled={refreshing}
            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-60">
            {refreshing ? t.loading : `🔄 ${t.newsRefresh}`}
          </button>
          <span className="text-xs text-amber-800 dark:text-amber-300">{message ?? t.newsAdminHint}</span>
        </div>
      )}

      {list.length > 0 && (
        <div className="space-y-3">
          {list.map(item => (
            <article key={item.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center gap-2 mb-1.5 text-xs">
                <span className={`font-bold px-2 py-0.5 rounded-full ${SOURCE_COLORS[item.source] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600'}`}>{item.source}</span>
                <time dateTime={item.published_at} className="text-gray-400">{newsDate(item.published_at, lang, t.months)}</time>
                {isAdmin && (
                  <button onClick={() => hide(item.id)} className="ml-auto text-red-500 hover:underline">{t.newsHide}</button>
                )}
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-white leading-snug">
                {lang === 'ka' ? item.title_ka : item.title_en}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">
                {lang === 'ka' ? item.summary_ka : item.summary_en}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-3 text-sm">
                <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="font-medium text-brand-600 hover:underline">
                  {t.newsReadSource(item.source)} ↗
                </a>
                <Link href={discussHref(item, lang)} className="font-medium text-gray-600 dark:text-gray-300 hover:text-brand-600">
                  💬 {t.newsDiscuss}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}

    </div>
  )
}
