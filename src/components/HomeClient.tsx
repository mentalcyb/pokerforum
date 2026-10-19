'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'
import { usePresence } from '@/contexts/PresenceContext'
import PokerAvatar from '@/components/PokerAvatar'
import ErrorState from '@/components/ErrorState'
import { flagUrl, trField } from '@/data/tournaments'
import { useUpcomingTournaments } from '@/lib/useUpcomingTournaments'
import { catName, catDesc, formatDate } from '@/lib/i18n'
import type { NewsItem } from '@/lib/news'
import { newsDate } from '@/components/NewsList'

const CATEGORY_ICONS: Record<string, string> = {
  spade: '♠', trophy: '🏆', money: '💰', dice: '🎲', book: '📚', brain: '🧠'
}

type Category = { id: number; name: string; description: string; name_en?: string | null; description_en?: string | null; icon: string; post_count: number }
type Post = { id: number; title: string; created_at: string; reply_count: number; view_count: number; profiles: { username: string }; categories: { name: string; name_en?: string | null } | null }
type Stats = { members: number; posts: number; online: number }
type OnlineUser = { id: string; username: string; avatar: string | null; is_admin: boolean }

export default function HomePage() {
  const { t, lang } = useApp()
  const upcoming = useUpcomingTournaments()
  const [categories, setCategories] = useState<Category[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [stats, setStats] = useState<Stats>({ members: 0, posts: 0, online: 0 })
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const presence = usePresence()
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // null until mounted, so the server-rendered HTML never contains a frozen build-time date
  const [now, setNow] = useState<Date | null>(null)
  const supabase = createClient()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    async function init() {
      // Update last_seen BEFORE loading stats so current user appears online
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { error: lsErr } = await supabase.from('profiles')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', user.id)
          if (lsErr) console.warn('[last_seen] update failed:', lsErr.message, lsErr.code)
        }
      } catch (e) {
        console.warn('[auth] getUser/last_seen failed:', e)
      }
      await load()
    }
    init()

    // Refresh stats every 30 seconds
    intervalRef.current = setInterval(loadStats, 30000)
    // Tick clock every second
    setNow(new Date())
    clockRef.current = setInterval(() => setNow(new Date()), 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (clockRef.current) clearInterval(clockRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadStats() {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const [{ count: memberCount }, { count: postCount }, { data: onlineData, error: onlineErr }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('profiles')
          .select('id, username, avatar, is_admin')
          .gte('last_seen', fiveMinutesAgo)
          .order('username'),
      ])
      if (onlineErr) console.warn('[online users] query error:', onlineErr.message, onlineErr.code)
      const online = (onlineData as unknown as OnlineUser[]) ?? []
      setOnlineUsers(online)
      setStats({
        members: memberCount ?? 0,
        posts: postCount ?? 0,
        online: online.length,
      })
    } catch (e) {
      console.warn('[stats] failed to load:', e)
    }
  }

  async function load() {
    setError(null)
    try {
      // Try sort_order first; if column doesn't exist yet fall back to id
      let { data: cats, error: catErr } = await supabase
        .from('categories').select('*').order('sort_order', { ascending: true }).order('id')
      if (catErr) {
        const { data: catsFallback, error: fallbackErr } = await supabase.from('categories').select('*').order('id')
        if (fallbackErr) throw fallbackErr
        cats = catsFallback
      }

      const { data: ps, error: psErr } = await supabase
        .from('posts')
        .select('id, title, created_at, reply_count, view_count, profiles(username), categories(*)')
        .order('created_at', { ascending: false }).limit(10)
      if (psErr) throw psErr

      setCategories(cats || [])
      setPosts((ps as any) || [])
      // latest news (optional: the table may not exist yet)
      supabase.from('news_items')
        .select('id, source, source_url, title_en, title_ka, summary_ka, summary_en, published_at')
        .order('published_at', { ascending: false }).limit(4)
        .then(({ data }) => setNews((data as NewsItem[]) ?? []))
      await loadStats()
    } catch (e) {
      console.error('[home] failed to load forum data:', e)
      setError(t.loadError)
    } finally {
      setLoading(false)
    }
  }

  function getTbilisiTime(date: Date) {
    // UTC+4
    const utc = date.getTime() + date.getTimezoneOffset() * 60000
    const tbilisi = new Date(utc + 4 * 3600000)
    const hh = String(tbilisi.getHours()).padStart(2, '0')
    const mm = String(tbilisi.getMinutes()).padStart(2, '0')
    const ss = String(tbilisi.getSeconds()).padStart(2, '0')
    return {
      time: `${hh}:${mm}:${ss}`,
      date: formatDate(tbilisi, t),
      weekday: t.weekdays[tbilisi.getDay()],
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins} ${t.min} ${t.ago}`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} ${t.hr} ${t.ago}`
    return `${Math.floor(hrs / 24)} ${t.day} ${t.ago}`
  }

  // Members come from recent activity (last 5 min); guests are visitors without an account on the site right now.
  const guestsOnline = presence.ready ? presence.guests : 0
  const totalOnline = stats.online + guestsOnline

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8 mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center text-white text-2xl">♠</div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.siteName}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t.tagline}</p>
          </div>
        </div>
        <div className="flex gap-8 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <div>
            <div className="text-xl font-bold text-brand-600">{loading ? '…' : stats.members.toLocaleString()}</div>
            <div className="text-xs text-gray-500">{t.members}</div>
          </div>
          <div>
            <div className="text-xl font-bold text-brand-600">{loading ? '…' : stats.posts.toLocaleString()}</div>
            <div className="text-xs text-gray-500">{t.posts}</div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block"></span>
              <span className="text-xl font-bold text-brand-600">{loading ? '…' : totalOnline}</span>
            </div>
            <div className="text-xs text-gray-500">{t.online_now}</div>
            {!loading && presence.ready && (
              <div className="text-[11px] text-gray-400 mt-0.5">{t.onlineBreakdown(stats.online, presence.guests)}</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Latest poker news */}
          {news.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white">{t.newsHomeTitle}</h2>
                <Link href="/news" className="text-xs font-semibold text-brand-600 hover:underline">{t.newsAll}</Link>
              </div>
              {news.map(item => (
                <Link key={item.id} href="/news" className="block px-5 py-3.5 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="text-[11px] text-gray-400 mb-0.5">{item.source} · {newsDate(item.published_at, lang, t.months)}</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white leading-snug">{lang === 'ka' ? item.title_ka : item.title_en}</div>
                </Link>
              ))}
            </div>
          )}

          {/* Categories */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">{t.categories}</h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-400">{t.loading}</div>
            ) : error ? (
              <ErrorState message={error} retryLabel={t.retry} onRetry={load} />
            ) : categories.map(cat => (
              <Link key={cat.id} href={`/category/${cat.id}`} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors last:border-0">
                <div className="w-10 h-10 bg-brand-50 dark:bg-brand-900/30 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                  {CATEGORY_ICONS[cat.icon] || '♠'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white text-sm">{catName(cat, lang)}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{catDesc(cat, lang)}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">{cat.post_count}</div>
                  <div className="text-xs text-gray-400">{t.postCount}</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Recent posts */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white">{t.recentPosts}</h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-400">{t.loading}</div>
            ) : error ? (
              <ErrorState message={error} retryLabel={t.retry} onRetry={load} />
            ) : posts.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <div className="text-3xl mb-2">♠</div>
                <div>{t.noPostsYet}</div>
                <Link href="/new-post" className="text-brand-600 text-sm mt-1 block">{t.beFirst}</Link>
              </div>
            ) : posts.map(post => (
              <Link key={post.id} href={`/post/${post.id}`} className="flex items-start gap-3 px-5 py-4 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-brand-600 font-medium mb-1">{catName(post.categories, lang)}</div>
                  <div className="font-medium text-gray-900 dark:text-white text-sm leading-snug">{post.title}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    <Link href={`/user/${encodeURIComponent(post.profiles?.username ?? '')}`} className="hover:text-brand-600 transition-colors">{post.profiles?.username}</Link>
                    {' · '}{timeAgo(post.created_at)}
                  </div>
                </div>
                <div className="text-right flex-shrink-0 text-xs text-gray-400 space-y-1">
                  <div>{post.reply_count} {t.replies}</div>
                  <div>{post.view_count} {t.views}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Live clock */}
          {(() => {
            const { time, date, weekday } = now ? getTbilisiTime(now) : { time: '--:--:--', date: '\u00a0', weekday: '\u00a0' }
            return (
              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 px-5 py-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="font-semibold text-gray-900 dark:text-white text-sm">🕐 {t.tbilisiTime}</h2>
                  <span className="text-xs text-gray-400">UTC+4</span>
                </div>
                <div className="text-3xl font-mono font-bold text-brand-600 tracking-wider">{time}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{weekday}</div>
                <div className="text-xs text-gray-400 mt-0.5">{date}</div>
              </div>
            )
          })()}

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">{t.upcomingTournaments}</h2>
            </div>
            {upcoming.length === 0 && <div className="px-5 py-4 text-xs text-gray-400">{t.noTournaments}</div>}
            {upcoming.slice(0, 4).map(tr => {
              const seriesColors: Record<string, string> = {
                EPT: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                WPT: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
                'WSOP Europe': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
                'WSOP Circuit': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
                RPT: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
                Merit: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400',
                APT: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                Local: 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400',
                PokerStars: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400',
                Triton: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400',
              }
              const badge = seriesColors[tr.series] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
              return (
                <div key={tr.id} className="px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge}`}>{tr.series === 'Local' ? t.trLocal : tr.series}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={flagUrl(tr)} width={16} height={11} alt={tr.country.toUpperCase()} className="inline-block rounded-[2px]" />
                  </div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white leading-snug">{tr.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">{trField(tr, 'location', lang)}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{trField(tr, 'dates', lang)}</span>
                    <span className="text-xs font-semibold text-brand-600">{tr.buyin}</span>
                  </div>
                </div>
              )
            })}
            <Link href="/tournaments" className="flex items-center justify-center gap-1 px-5 py-3 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors border-t border-gray-100 dark:border-gray-800">
              {t.allSeries} →
            </Link>
          </div>

          {/* Online users */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">{t.onlineUsers}</h2>
              <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                {totalOnline}
              </span>
            </div>
            {loading || (onlineUsers.length === 0 && guestsOnline === 0) ? (
              <div className="px-5 py-4 text-xs text-gray-400">
                {loading ? t.loading : t.noOnlineUsers}
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800">
                {onlineUsers.map(u => (
                  <Link key={u.id} href={`/user/${encodeURIComponent(u.username)}`} className="flex items-center gap-2.5 px-5 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="relative flex-shrink-0">
                      <PokerAvatar avatarId={u.avatar} size={28} />
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-gray-900" />
                    </div>
                    <span className={`text-sm truncate hover:text-brand-600 transition-colors ${
                      u.is_admin
                        ? 'font-bold text-gray-900 dark:text-white'
                        : 'font-medium text-gray-700 dark:text-gray-300'
                    }`}>
                      {u.username}
                    </span>
                    {u.is_admin && (
                      <span className="ml-auto flex-shrink-0 text-xs font-semibold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                        {t.adminBadge}
                      </span>
                    )}
                  </Link>
                ))}
                {guestsOnline > 0 && (
                  <div className="flex items-center gap-2.5 px-5 py-2.5">
                    <div className="relative flex-shrink-0 w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-sm">
                      👤
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-gray-900" />
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{t.guestsOnline(guestsOnline)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <Link href="/home-games" className="block rounded-2xl p-5 bg-gradient-to-br from-emerald-700 to-emerald-900 text-white hover:opacity-95 transition-opacity">
            <div className="text-2xl mb-2">🃏</div>
            <h2 className="font-semibold mb-1">{t.hgPromoTitle}</h2>
            <p className="text-sm text-emerald-100 mb-3">{t.hgPromoText}</p>
            <span className="inline-block bg-white text-emerald-800 font-medium text-sm px-4 py-2 rounded-lg">{t.hgPromoCta}</span>
          </Link>

          <div className="bg-brand-600 rounded-2xl p-5 text-white">
            <div className="text-2xl mb-2">♠</div>
            <div className="font-semibold mb-1">{t.newPost}</div>
            <div className="text-sm text-brand-100 mb-3">{t.tagline}</div>
            <Link href="/new-post" className="block w-full text-center bg-white text-brand-700 font-medium text-sm py-2 rounded-lg hover:bg-brand-50 transition-colors">
              + {t.newPost}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
