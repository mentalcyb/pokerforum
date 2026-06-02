'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'
import Link from 'next/link'
import PokerAvatar from '@/components/PokerAvatar'

interface Profile {
  id: string
  username: string
  avatar: string | null
  signature: string | null
  is_admin: boolean
  created_at: string
}
interface Post {
  id: number
  title: string
  created_at: string
  reply_count: number
  view_count: number
  categories: { name: string } | null
}

export default function UserProfilePage() {
  const { t } = useApp()
  const params = useParams()
  const username = decodeURIComponent(params.username as string)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [msgText, setMsgText] = useState('')
  const [msgSending, setMsgSending] = useState(false)
  const [msgSent, setMsgSent] = useState(false)
  const [msgError, setMsgError] = useState<string | null>(null)
  const [showMsgForm, setShowMsgForm] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)

      const { data: prof } = await supabase
        .from('profiles')
        .select('id, username, avatar, signature, is_admin, created_at')
        .eq('username', username)
        .single()

      if (!prof) { setLoading(false); return }
      setProfile(prof as Profile)

      const { data: ps } = await supabase
        .from('posts')
        .select('id, title, created_at, reply_count, view_count, categories(name)')
        .eq('user_id', prof.id)
        .order('created_at', { ascending: false })
        .limit(20)

      setPosts((ps as unknown as Post[]) ?? [])
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!currentUserId || !profile || !msgText.trim()) return
    setMsgSending(true); setMsgError(null)
    const { error } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: profile.id,
      content: msgText.trim(),
    })
    if (error) { setMsgError(error.message); setMsgSending(false); return }
    setMsgText(''); setMsgSent(true); setShowMsgForm(false); setMsgSending(false)
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins} ${t.min} ${t.ago}`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} ${t.hr} ${t.ago}`
    const days = Math.floor(hrs / 24)
    if (days < 30) return `${days} ${t.day} ${t.ago}`
    return new Date(dateStr).toLocaleDateString()
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400">{t.loading}</div>
  if (!profile) return <div className="flex items-center justify-center min-h-screen text-gray-400">{t.categoryNotFound}</div>

  const joinDate = new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  const isOwnProfile = currentUserId === profile.id
  const canMessage = !!currentUserId && !isOwnProfile

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/" className="text-brand-600 text-sm hover:underline mb-4 block">← {t.home}</Link>

      {/* Profile card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 mb-6">
        <div className="flex items-start gap-5">
          <PokerAvatar avatarId={profile.avatar} size={72} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{profile.username}</h1>
              {profile.is_admin && (
                <span className="px-2 py-0.5 text-xs font-semibold rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                  {t.adminBadge}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
              <span>📅 {t.joinDate}: {joinDate}</span>
              <span>📝 {posts.length} {t.postCountLabel}</span>
            </div>
            {profile.signature && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-sm text-gray-500 dark:text-gray-400 italic">
                "{profile.signature}"
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            {isOwnProfile && (
              <Link href="/profile" className="px-3 py-1.5 text-xs border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-center">
                ✏️ {t.profileSettings}
              </Link>
            )}
            {canMessage && (
              <button
                onClick={() => { setShowMsgForm(v => !v); setMsgSent(false) }}
                className="px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
              >
                ✉️ {t.sendMessage}
              </button>
            )}
            {currentUserId && (
              <Link href="/inbox" className="px-3 py-1.5 text-xs border border-brand-200 dark:border-brand-800 text-brand-600 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors text-center">
                📬 {t.inbox}
              </Link>
            )}
          </div>
        </div>

        {/* Message form */}
        {showMsgForm && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <form onSubmit={sendMessage} className="space-y-2">
              <textarea
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                rows={3}
                placeholder={t.messagePlaceholder}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              />
              {msgError && <p className="text-xs text-red-500">{msgError}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={msgSending || !msgText.trim()}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                  {msgSending ? t.loading : t.sendMessage}
                </button>
                <button type="button" onClick={() => setShowMsgForm(false)}
                  className="px-4 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  {t.cancel}
                </button>
              </div>
            </form>
          </div>
        )}
        {msgSent && (
          <div className="mt-3 px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm rounded-lg">
            ✓ {t.messageSent}
          </div>
        )}
      </div>

      {/* Recent posts */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white text-sm">{t.recentPosts}</h2>
        </div>
        {posts.length === 0 ? (
          <div className="p-8 text-center text-gray-400">{t.noPostsYet}</div>
        ) : posts.map(post => (
          <Link key={post.id} href={`/post/${post.id}`}
            className="flex items-center gap-4 px-5 py-4 border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors last:border-0">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-brand-600 mb-0.5">{post.categories?.name}</div>
              <div className="font-medium text-gray-900 dark:text-white text-sm truncate">{post.title}</div>
              <div className="text-xs text-gray-400 mt-0.5">{timeAgo(post.created_at)}</div>
            </div>
            <div className="text-right flex-shrink-0 text-xs text-gray-400 space-y-0.5">
              <div>{post.reply_count} {t.replies}</div>
              <div>{post.view_count} {t.views}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
