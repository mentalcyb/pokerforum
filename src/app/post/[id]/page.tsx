'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'
import Link from 'next/link'
import ContentRenderer from '@/components/ContentRenderer'

type Post = { id: number; title: string; content: string; created_at: string; reply_count: number; view_count: number; profiles: { username: string }; categories: { name: string } }
type Reply = { id: number; content: string; created_at: string; profiles: { username: string } }

export default function PostPage() {
  const { t } = useApp()
  const params = useParams()
  const [post, setPost] = useState<Post | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [replyText, setReplyText] = useState('')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    loadPost()
  }, [params.id])

  async function loadPost() {
    const { data: p } = await supabase.from('posts')
      .select('id, title, content, created_at, reply_count, view_count, profiles(username), categories(name)')
      .eq('id', params.id).single()
    setPost(p as any)
    const { data: r } = await supabase.from('replies')
      .select('id, content, created_at, profiles(username)')
      .eq('post_id', params.id).order('created_at')
    setReplies((r as any) || [])
    if (p) await supabase.from('posts').update({ view_count: (p as any).view_count + 1 }).eq('id', params.id)
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !replyText.trim()) return
    setLoading(true)
    await supabase.from('replies').insert({ content: replyText, user_id: user.id, post_id: params.id })
    await supabase.from('posts').update({ reply_count: (post?.reply_count || 0) + 1 }).eq('id', params.id)
    setReplyText('')
    await loadPost()
    setLoading(false)
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins} წთ ${t.ago}`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} სთ ${t.ago}`
    return `${Math.floor(hrs / 24)} დღე ${t.ago}`
  }

  if (!post) return <div className="flex items-center justify-center min-h-screen text-gray-400">{t.loading}</div>

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/" className="text-brand-600 text-sm hover:underline mb-4 block">← {t.home}</Link>
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 mb-4">
        <div className="text-xs text-brand-600 font-medium mb-2">{(post.categories as any)?.name}</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{post.title}</h1>
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {t.postedBy} <span className="font-medium text-gray-700 dark:text-gray-300">{(post.profiles as any)?.username}</span> · {timeAgo(post.created_at)}
        </div>
        <ContentRenderer content={post.content} className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed" />
        <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
          <span>{post.reply_count} {t.replies}</span>
          <span>{post.view_count} {t.views}</span>
        </div>
      </div>

      {replies.map(r => (
        <div key={r.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 bg-brand-100 dark:bg-brand-900/40 rounded-full flex items-center justify-center text-brand-700 dark:text-brand-400 text-xs font-bold">
              {(r.profiles as any)?.username?.[0]?.toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{(r.profiles as any)?.username}</span>
            <span className="text-xs text-gray-400">{timeAgo(r.created_at)}</span>
          </div>
          <ContentRenderer content={r.content} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed" />
        </div>
      ))}

      {user ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mt-4">
          <h3 className="font-medium text-gray-900 dark:text-white text-sm mb-3">{t.reply}</h3>
          <form onSubmit={handleReply} className="space-y-3">
            <textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={4} placeholder={t.replyPlaceholder}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
              {loading ? t.loading : t.submit}
            </button>
          </form>
        </div>
      ) : (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 p-5 mt-4 text-center">
          <Link href="/auth" className="text-brand-600 font-medium text-sm hover:underline">{t.login}</Link>
          <span className="text-gray-500 text-sm"> · </span>
          <Link href="/auth?mode=register" className="text-brand-600 font-medium text-sm hover:underline">{t.register}</Link>
        </div>
      )}
    </div>
  )
}