'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'

const CATEGORY_ICONS: Record<string, string> = {
  spade: '♠', trophy: '🏆', money: '💰', dice: '🎲', book: '📚', brain: '🧠'
}

type Category = { id: number; name: string; description: string; icon: string; post_count: number }
type Post = { id: number; title: string; created_at: string; reply_count: number; view_count: number; profiles: { username: string }; categories: { name: string } }
type Tournament = { id: number; name: string; date: string; buyin: string; status: string }

export default function HomePage() {
  const { t } = useApp()
  const [categories, setCategories] = useState<Category[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: cats }, { data: ps }, { data: ts }] = await Promise.all([
        supabase.from('categories').select('*').order('id'),
        supabase.from('posts').select('id, title, created_at, reply_count, view_count, profiles(username), categories(name)').order('created_at', { ascending: false }).limit(10),
        supabase.from('tournaments').select('*').order('created_at'),
      ])
      setCategories(cats || [])
      setPosts((ps as any) || [])
      setTournaments(ts || [])
      setLoading(false)
    }
    load()
  }, [])

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins} წთ ${t.ago}`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} სთ ${t.ago}`
    return `${Math.floor(hrs / 24)} დღე ${t.ago}`
  }

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
          <div><div className="text-xl font-bold text-brand-600">4,821</div><div className="text-xs text-gray-500">{t.members}</div></div>
          <div><div className="text-xl font-bold text-brand-600">{posts.length}+</div><div className="text-xs text-gray-500">{t.posts}</div></div>
          <div><div className="text-xl font-bold text-brand-600">143</div><div className="text-xs text-gray-500">{t.online_now}</div></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Categories */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white">{t.categories}</h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-400">{t.loading}</div>
            ) : categories.map(cat => (
              <Link key={cat.id} href={`/category/${cat.id}`} className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors last:border-0">
                <div className="w-10 h-10 bg-brand-50 dark:bg-brand-900/30 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                  {CATEGORY_ICONS[cat.icon] || '♠'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white text-sm">{cat.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{cat.description}</div>
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
            ) : posts.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <div className="text-3xl mb-2">♠</div>
                <div>{t.noPostsYet}</div>
                <Link href="/new-post" className="text-brand-600 text-sm mt-1 block">{t.beFirst}</Link>
              </div>
            ) : posts.map(post => (
              <Link key={post.id} href={`/post/${post.id}`} className="flex items-start gap-3 px-5 py-4 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-brand-600 font-medium mb-1">{post.categories?.name}</div>
                  <div className="font-medium text-gray-900 dark:text-white text-sm leading-snug">{post.title}</div>
                  <div className="text-xs text-gray-400 mt-1">{post.profiles?.username} · {timeAgo(post.created_at)}</div>
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
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm">{t.upcomingTournaments}</h2>
            </div>
            {tournaments.length === 0
              ? <div className="p-5 text-center text-xs text-gray-400">ტურნირები არ არის</div>
              : tournaments.map(tr => (
                <div key={tr.id} className="px-5 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{tr.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{tr.date} · {tr.buyin}</div>
                </div>
              ))
            }
          </div>

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
