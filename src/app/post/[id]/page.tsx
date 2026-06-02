'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'
import Link from 'next/link'
import ContentRenderer from '@/components/ContentRenderer'
import ImageUploader from '@/components/ImageUploader'
import PokerAvatar from '@/components/PokerAvatar'

type Post = {
  id: number; title: string; content: string; created_at: string
  reply_count: number; view_count: number; user_id: string
  profiles: { username: string; avatar?: string }; categories: { name: string }
}
type Reply = { id: number; content: string; created_at: string; profiles: { username: string; avatar?: string } }

export default function PostPage() {
  const { t } = useApp()
  const params = useParams()
  const [post, setPost] = useState<Post | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [replyText, setReplyText] = useState('')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    loadPost()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  async function loadPost() {
    const { data: p } = await supabase.from('posts')
      .select('id, title, content, created_at, reply_count, view_count, user_id, profiles(username, avatar), categories(name)')
      .eq('id', params.id).single()
    setPost(p as any)
    const { data: r } = await supabase.from('replies')
      .select('id, content, created_at, profiles(username, avatar)')
      .eq('post_id', params.id).order('created_at')
    setReplies((r as any) || [])
    if (p) await supabase.from('posts').update({ view_count: (p as any).view_count + 1 }).eq('id', params.id)
  }

  function startEditing() {
    if (!post) return
    setEditTitle(post.title)
    setEditContent(post.content)
    setEditError(null)
    setEditing(true)
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!post || !editTitle.trim() || !editContent.trim()) return
    setEditSaving(true)
    setEditError(null)
    const { error } = await supabase.from('posts')
      .update({ title: editTitle, content: editContent })
      .eq('id', post.id)
    if (error) { setEditError(error.message); setEditSaving(false); return }
    setPost(prev => prev ? { ...prev, title: editTitle, content: editContent } : prev)
    setEditing(false)
    setEditSaving(false)
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

  function insertAtCursor(url: string) {
    setReplyText(prev => prev + (prev && !prev.endsWith('\n') ? '\n' : '') + url + '\n')
  }

  function insertIntoEdit(url: string) {
    setEditContent(prev => prev + (prev && !prev.endsWith('\n') ? '\n' : '') + url + '\n')
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins} ${t.min} ${t.ago}`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} ${t.hr} ${t.ago}`
    return `${Math.floor(hrs / 24)} ${t.day} ${t.ago}`
  }

  if (!post) return <div className="flex items-center justify-center min-h-screen text-gray-400">{t.loading}</div>

  const isAuthor = user && user.id === post.user_id

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/" className="text-brand-600 text-sm hover:underline mb-4 block">← {t.home}</Link>

      {/* Post */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 mb-4">
        {editing ? (
          /* ── Inline edit form ── */
          <form onSubmit={saveEdit} className="space-y-3">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.editPostTitle}</div>
            {editError && (
              <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">{editError}</div>
            )}
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              required
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">{t.content}</span>
                <ImageUploader userId={user.id} onInsert={insertIntoEdit} />
              </div>
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                required
                rows={8}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={editSaving}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {editSaving ? t.loading : t.saveChanges}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {t.cancel}
              </button>
            </div>
          </form>
        ) : (
          /* ── Normal post view ── */
          <>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="text-xs text-brand-600 font-medium">{(post.categories as any)?.name}</div>
              {isAuthor && (
                <button
                  onClick={startEditing}
                  className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  {t.editPostBtn}
                </button>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{post.title}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
              <PokerAvatar avatarId={(post.profiles as any)?.avatar} size={24} />
              <span className="font-medium text-gray-700 dark:text-gray-300">{(post.profiles as any)?.username}</span>
              <span>·</span>
              <span>{timeAgo(post.created_at)}</span>
            </div>
            <ContentRenderer content={post.content} className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed" />
            <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
              <span>{post.reply_count} {t.replies}</span>
              <span>{post.view_count} {t.views}</span>
            </div>
          </>
        )}
      </div>

      {/* Replies */}
      {replies.map(r => (
        <div key={r.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mb-3">
          <div className="flex items-center gap-2 mb-3">
            <PokerAvatar avatarId={(r.profiles as any)?.avatar} size={28} />
            <span className="text-sm font-medium text-gray-900 dark:text-white">{(r.profiles as any)?.username}</span>
            <span className="text-xs text-gray-400">{timeAgo(r.created_at)}</span>
          </div>
          <ContentRenderer content={r.content} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed" />
        </div>
      ))}

      {/* Reply form */}
      {user ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mt-4">
          <h3 className="font-medium text-gray-900 dark:text-white text-sm mb-3">{t.reply}</h3>
          <form onSubmit={handleReply} className="space-y-3">
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              rows={4}
              placeholder={t.replyPlaceholder}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
            <div className="flex items-center justify-between gap-3">
              <ImageUploader userId={user.id} onInsert={insertAtCursor} />
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {loading ? t.loading : t.submit}
              </button>
            </div>
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
