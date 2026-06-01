'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'
import Link from 'next/link'

const CATEGORY_ICONS: Record<string, string> = {
  spade: '♠', trophy: '🏆', money: '💰', dice: '🎲', book: '📚', brain: '🧠'
}

interface Category { id: number; name: string; description: string; icon: string; post_count: number }
interface Post { id: number; title: string; created_at: string; reply_count: number; view_count: number; profiles: { username: string } | null }

export default function CategoryPage() {
  const { t } = useApp()
  const params = useParams()
  const [category, setCategory] = useState<Category | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const [{ data: cat }, { data: ps }] = await Promise.all([
        supabase.from('categories').select('*').eq('id', params.id).single(),
        supabase
          .from('posts')
          .select('id, title, created_at, reply_count, view_count, profiles(username)')
          .eq('category_id', params.id)
          .order('created_at', { ascending: false }),
      ])
      setCategory(cat)
      setPosts((ps as unknown as Post[]) ?? [])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins} ${t.min} ${t.ago}`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} ${t.hr} ${t.ago}`
    return `${Math.floor(hrs / 24)} ${t.day} ${t.ago}`
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-gray-400">{t.loading}</div>
  )

  if (!category) return (
    <div className="flex items-center justify-center min-h-screen text-gray-400">{t.categoryNotFound}</div>
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <Link href="/" className="hover:text-brand-600 transition-colors">{t.home}</Link>
        <span>›</span>
        <span className="text-gray-700 dark:text-gray-300 font-medium">{category.name}</span>
      </div>

      {/* Category header */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-50 dark:bg-brand-900/30 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
            {CATEGORY_ICONS[category.icon] || '♠'}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{category.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{category.description}</p>
            <p className="text-xs text-gray-400 mt-1">{posts.length} {t.posts}</p>
          </div>
        </div>
        <Link
          href={`/new-post?category=${category.id}`}
          className="flex-shrink-0 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + {t.newPost}
        </Link>
      </div>

      {/* Posts list */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {posts.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <div className="text-4xl mb-3">{CATEGORY_ICONS[category.icon] || '♠'}</div>
            <div className="font-medium mb-1">{t.noPostsYet}</div>
            <Link href={`/new-post?category=${category.id}`} className="text-brand-600 text-sm hover:underline">
              {t.beFirst}
            </Link>
          </div>
        ) : (
          posts.map(post => (
            <Link
              key={post.id}
              href={`/post/${post.id}`}
              className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors last:border-0"
            >
              <div className="w-9 h-9 bg-brand-50 dark:bg-brand-900/30 rounded-full flex items-center justify-center text-brand-600 text-sm font-bold flex-shrink-0">
                {post.profiles?.username?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 dark:text-white text-sm leading-snug truncate">{post.title}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {post.profiles?.username ?? 'unknown'} · {timeAgo(post.created_at)}
                </div>
              </div>
              <div className="text-right flex-shrink-0 text-xs text-gray-400 space-y-0.5">
                <div>{post.reply_count} {t.replies}</div>
                <div>{post.view_count} {t.views}</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
