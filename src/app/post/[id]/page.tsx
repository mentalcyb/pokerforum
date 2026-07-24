'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'
import Link from 'next/link'
import ContentRenderer from '@/components/ContentRenderer'
import ImageUploader from '@/components/ImageUploader'
import PokerAvatar from '@/components/PokerAvatar'
import EmojiPicker from '@/components/EmojiPicker'
import ErrorState from '@/components/ErrorState'

type Post = {
  id: number; title: string; content: string; created_at: string
  reply_count: number; view_count: number; user_id: string
  profiles: { username: string; avatar?: string; signature?: string; is_moderator?: boolean }; categories: { name: string }
}
type Reply = { id: number; content: string; created_at: string; user_id?: string; profiles: { username: string; avatar?: string; signature?: string; is_moderator?: boolean } }

const REPLY_PAGE_SIZE = 30

export default function PostPage() {
  const { t } = useApp()
  const params = useParams()
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [hasMoreReplies, setHasMoreReplies] = useState(false)
  const [loadingMoreReplies, setLoadingMoreReplies] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyError, setReplyError] = useState<string | null>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [pageLoading, setPageLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [isMod, setIsMod] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isBanned, setIsBanned] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user)
      if (data.user) {
        const { data: prof } = await supabase.from('profiles')
          .select('is_moderator, is_admin, is_banned').eq('id', data.user.id).single()
        if (prof) {
          setIsMod(prof.is_moderator || false)
          setIsAdmin(prof.is_admin || false)
          setIsBanned(prof.is_banned || false)
        }
      }
    }).catch(e => console.warn('[PostPage] auth check failed:', e))
    loadPost()

    // Pre-fill reply from hand analyzer if available
    const prefill = localStorage.getItem('hand-analyzer-prefill')
    if (prefill) {
      setReplyText(prefill)
      localStorage.removeItem('hand-analyzer-prefill')
      setTimeout(() => {
        textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 800)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id])

  async function loadPost() {
    setPageLoading(true)
    setPageError(null)

    try {
      const { data: p, error: pErr } = await supabase.from('posts')
        .select('id, title, content, created_at, reply_count, view_count, user_id, profiles(username, avatar, signature, is_moderator), categories(name)')
        .eq('id', params.id).single()

      let current: any = p
      if (pErr) {
        console.error('[PostPage] post fetch error:', pErr.message, pErr.code)
        // Retry without signature in case the column doesn't exist yet
        const { data: p2, error: p2Err } = await supabase.from('posts')
          .select('id, title, content, created_at, reply_count, view_count, user_id, profiles(username, avatar, is_moderator), categories(name)')
          .eq('id', params.id).single()
        if (p2Err) throw p2Err
        current = p2
      }
      setPost(current as any)

      // Fetch the most recent REPLY_PAGE_SIZE replies (newest first), then
      // reverse to chronological order for display — bounds the payload on
      // long-running threads instead of fetching every reply ever posted.
      const { data: r, error: rErr } = await supabase.from('replies')
        .select('id, content, created_at, user_id, profiles(username, avatar, signature, is_moderator)')
        .eq('post_id', params.id).order('created_at', { ascending: false }).limit(REPLY_PAGE_SIZE)

      let latestReplies: any = r
      if (rErr) {
        // Retry without signature
        const { data: r2 } = await supabase.from('replies')
          .select('id, content, created_at, user_id, profiles(username, avatar, is_moderator)')
          .eq('post_id', params.id).order('created_at', { ascending: false }).limit(REPLY_PAGE_SIZE)
        latestReplies = r2
      }
      const latest = ((latestReplies as any) || []).slice().reverse()
      setReplies(latest)
      setHasMoreReplies(latest.length === REPLY_PAGE_SIZE)

      if (current) {
        await supabase.from('posts').update({ view_count: current.view_count + 1 }).eq('id', params.id)
      }
    } catch (e) {
      console.error('[PostPage] failed to load post:', e)
      setPageError(t.loadError)
    } finally {
      setPageLoading(false)
    }
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

  async function modDeletePost() {
    if (!confirm(t.confirmDeletePost)) return
    await supabase.from('replies').delete().eq('post_id', post?.id)
    await supabase.from('posts').delete().eq('id', post?.id)
    router.push('/')
  }

  async function modDeleteReply(replyId: number) {
    if (!confirm(t.confirmDeleteReply)) return
    await supabase.from('replies').delete().eq('id', replyId)
    setReplies(prev => prev.filter(r => r.id !== replyId))
    if (post) setPost({ ...post, reply_count: post.reply_count - 1 })
  }

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !replyText.trim()) return
    if (isBanned) return
    setLoading(true)
    setReplyError(null)
    try {
      const { data, error } = await supabase.from('replies')
        .insert({ content: replyText, user_id: user.id, post_id: params.id })
        .select('id, content, created_at, user_id, profiles(username, avatar, signature, is_moderator)')
        .single()
      if (error) throw error
      await supabase.from('posts').update({ reply_count: (post?.reply_count || 0) + 1 }).eq('id', params.id)
      setReplies(prev => [...prev, data as any])
      setPost(prev => prev ? { ...prev, reply_count: prev.reply_count + 1 } : prev)
      setReplyText('')
    } catch (err) {
      console.error('[PostPage] failed to submit reply:', err)
      setReplyError(t.loadError)
    } finally {
      setLoading(false)
    }
  }

  async function loadMoreReplies() {
    if (!replies.length || loadingMoreReplies) return
    setLoadingMoreReplies(true)
    try {
      const oldest = replies[0].created_at
      const { data, error } = await supabase.from('replies')
        .select('id, content, created_at, user_id, profiles(username, avatar, signature, is_moderator)')
        .eq('post_id', params.id)
        .lt('created_at', oldest)
        .order('created_at', { ascending: false })
        .limit(REPLY_PAGE_SIZE)
      if (error) throw error
      const older = ((data as any) || []).slice().reverse()
      setReplies(prev => [...older, ...prev])
      setHasMoreReplies(older.length === REPLY_PAGE_SIZE)
    } catch (e) {
      console.warn('[PostPage] failed to load more replies:', e)
    } finally {
      setLoadingMoreReplies(false)
    }
  }

  function insertAtCursor(text: string) {
    const ta = textareaRef.current
    if (ta) {
      const start = ta.selectionStart
      const end = ta.selectionEnd
      setReplyText(prev => prev.slice(0, start) + text + prev.slice(end))
      // Restore cursor after emoji
      setTimeout(() => {
        ta.selectionStart = ta.selectionEnd = start + text.length
        ta.focus()
      }, 0)
    } else {
      setReplyText(prev => prev + text)
    }
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

  if (pageLoading) return <div className="flex items-center justify-center min-h-screen text-gray-400">{t.loading}</div>
  if (pageError) return (
    <div className="flex items-center justify-center min-h-screen">
      <ErrorState message={pageError} retryLabel={t.retry} onRetry={loadPost} />
    </div>
  )
  if (!post) return <div className="flex items-center justify-center min-h-screen text-gray-400">{t.categoryNotFound}</div>

  const isAuthor = user && user.id === post.user_id
  const canModerate = isMod || isAdmin

  function ModBadge({ profile }: { profile: { is_moderator?: boolean } | null }) {
    if (!profile?.is_moderator) return null
    return <span className="px-1.5 py-0.5 text-xs font-semibold rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">{t.isModerator}</span>
  }

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
              <div className="flex gap-2 flex-shrink-0">
              {canModerate && !isAuthor && (
                <button onClick={modDeletePost}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs border border-red-200 dark:border-red-800 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  🗑️ {t.delete}
                </button>
              )}
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
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{post.title}</h1>
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4 flex-wrap">
              <Link href={`/user/${encodeURIComponent((post.profiles as any)?.username ?? '')}`}>
                <PokerAvatar avatarId={(post.profiles as any)?.avatar} size={24} className="hover:opacity-80 transition-opacity" />
              </Link>
              <Link href={`/user/${encodeURIComponent((post.profiles as any)?.username ?? '')}`} className="font-medium text-gray-700 dark:text-gray-300 hover:text-brand-600 transition-colors">
                {(post.profiles as any)?.username}
              </Link>
              <ModBadge profile={post.profiles as any} />
              <span>·</span>
              <span>{timeAgo(post.created_at)}</span>
            </div>
            <ContentRenderer content={post.content} className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed" />
            {(post.profiles as any)?.signature && (
              <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-gray-700 text-xs text-gray-400 italic">
                {(post.profiles as any).signature}
              </div>
            )}
            <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
              <span>{post.reply_count} {t.replies}</span>
              <span>{post.view_count} {t.views}</span>
            </div>
          </>
        )}
      </div>

      {/* Replies */}
      {hasMoreReplies && (
        <button
          onClick={loadMoreReplies}
          disabled={loadingMoreReplies}
          className="w-full mb-3 py-2 text-xs font-medium text-brand-600 border border-brand-200 dark:border-brand-800 rounded-xl hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors disabled:opacity-50"
        >
          {loadingMoreReplies ? t.loading : '↑ Load earlier replies'}
        </button>
      )}
      {replies.map(r => (
        <div key={r.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mb-3">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Link href={`/user/${encodeURIComponent((r.profiles as any)?.username ?? '')}`}>
              <PokerAvatar avatarId={(r.profiles as any)?.avatar} size={28} className="hover:opacity-80 transition-opacity" />
            </Link>
            <Link href={`/user/${encodeURIComponent((r.profiles as any)?.username ?? '')}`} className="text-sm font-medium text-gray-900 dark:text-white hover:text-brand-600 transition-colors">
              {(r.profiles as any)?.username}
            </Link>
            <ModBadge profile={r.profiles as any} />
            <span className="text-xs text-gray-400">{timeAgo(r.created_at)}</span>
            {canModerate && (
              <button onClick={() => modDeleteReply(r.id)}
                className="ml-auto text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
                🗑️
              </button>
            )}
          </div>
          <ContentRenderer content={r.content} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed" />
          {(r.profiles as any)?.signature && (
            <div className="mt-3 pt-2 border-t border-dashed border-gray-200 dark:border-gray-700 text-xs text-gray-400 italic">
              {(r.profiles as any).signature}
            </div>
          )}
        </div>
      ))}

      {/* Reply form */}
      {user ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mt-4">
          <h3 className="font-medium text-gray-900 dark:text-white text-sm mb-3">{t.reply}</h3>
          {isBanned && (
            <div className="mb-3 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">🚫 {t.bannedMessage}</div>
          )}
          {replyError && (
            <div className="mb-3 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">{replyError}</div>
          )}
          <form onSubmit={handleReply} className="space-y-3">
            <textarea
              ref={textareaRef}
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              rows={4}
              placeholder={t.replyPlaceholder}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <EmojiPicker onSelect={emoji => insertAtCursor(emoji)} />
                <ImageUploader userId={user.id} onInsert={insertAtCursor} />
              </div>
              <button
                type="submit"
                disabled={loading || isBanned}
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
