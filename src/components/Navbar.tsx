'use client'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import PokerAvatar from '@/components/PokerAvatar'

export default function Navbar() {
  const { t, lang, setLang, dark, toggleDark } = useApp()
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [avatar, setAvatar] = useState<string>('spade')
  const [unreadCount, setUnreadCount] = useState(0)
  const supabase = createClient()

  async function loadProfile(uid: string) {
    const { data: p } = await supabase
      .from('profiles').select('is_admin, avatar').eq('id', uid).single()
    if (p) {
      setIsAdmin(p.is_admin || false)
      setAvatar(p.avatar || 'spade')
    }
    supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', uid).then(() => {})
    // Unread message count
    supabase.from('messages').select('id', { count: 'exact', head: true })
      .eq('receiver_id', uid).eq('read', false)
      .then(({ count }) => setUnreadCount(count ?? 0))
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) loadProfile(data.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else { setIsAdmin(false); setAvatar('spade'); setUnreadCount(0) }
    })

    // Listen for avatar changes saved from the profile page
    const onAvatarUpdated = (e: Event) => setAvatar((e as CustomEvent).detail)
    window.addEventListener('avatar-updated', onAvatarUpdated)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('avatar-updated', onAvatarUpdated)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setIsAdmin(false)
    setAvatar('spade')
    setUnreadCount(0)
  }

  return (
    <nav className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="pokerforum.ge logo" width={48} height={48} className="rounded-full" />
          <span className="font-semibold text-gray-900 dark:text-white">{t.siteName}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://flagcdn.com/w20/ge.png" width={20} height={14} alt="GE" className="inline-block" />
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang(lang === 'ka' ? 'en' : 'ka')}
            className="px-2 py-1 text-sm rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium text-gray-700 dark:text-gray-300"
          >
            {lang === 'ka' ? 'EN' : 'ქარ'}
          </button>

          <button
            onClick={toggleDark}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
            title={dark ? t.lightMode : t.darkMode}
          >
            {dark ? '☀️' : '🌙'}
          </button>

          {user ? (
            <>
              {isAdmin && (
                <Link href="/admin" className="px-3 py-1.5 text-sm text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors font-medium">
                  ⚙️ Admin
                </Link>
              )}
              <Link href="/new-post" className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg transition-colors font-medium">
                + {t.newPost}
              </Link>
              {/* Inbox with unread badge */}
              <Link href="/inbox" className="relative flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400" title={t.inbox}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-600 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              {/* Avatar → profile link */}
              <Link href="/profile" className="flex items-center gap-1.5 hover:opacity-80 transition-opacity" title={t.profile}>
                <PokerAvatar avatarId={avatar} size={30} />
              </Link>
              <button onClick={handleLogout} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                {t.logout}
              </button>
            </>
          ) : (
            <>
              <Link href="/auth?mode=login" className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                {t.login}
              </Link>
              <Link href="/auth?mode=register" className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg transition-colors font-medium">
                {t.register}
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
