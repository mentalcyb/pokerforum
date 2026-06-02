'use client'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import PokerAvatar from '@/components/PokerAvatar'

export default function Navbar() {
  const { t, lang, setLang, dark, toggleDark } = useApp()
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [avatar, setAvatar] = useState<string>('spade')
  const [unreadCount, setUnreadCount] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  async function loadProfile(uid: string) {
    const { data: p } = await supabase
      .from('profiles').select('is_admin, avatar').eq('id', uid).single()
    if (p) {
      setIsAdmin(p.is_admin || false)
      setAvatar(p.avatar || 'spade')
    }
    supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', uid).then(() => {})
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
    const onAvatarUpdated = (e: Event) => setAvatar((e as CustomEvent).detail)
    window.addEventListener('avatar-updated', onAvatarUpdated)

    // Close menu on outside click
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)

    return () => {
      subscription.unsubscribe()
      window.removeEventListener('avatar-updated', onAvatarUpdated)
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null); setIsAdmin(false); setAvatar('spade'); setUnreadCount(0)
    setMenuOpen(false)
  }

  const close = () => setMenuOpen(false)

  return (
    <nav className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2" onClick={close}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="pokerforum.ge logo" width={48} height={48} className="rounded-full" />
          <span className="font-semibold text-gray-900 dark:text-white">{t.siteName}</span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://flagcdn.com/w20/ge.png" width={20} height={14} alt="GE" className="inline-block" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-2">
          <button onClick={() => setLang(lang === 'ka' ? 'en' : 'ka')}
            className="px-2 py-1 text-sm rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium text-gray-700 dark:text-gray-300">
            {lang === 'ka' ? 'EN' : 'ქარ'}
          </button>
          <button onClick={toggleDark}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
            title={dark ? t.lightMode : t.darkMode}>
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
              <Link href="/profile" className="flex items-center hover:opacity-80 transition-opacity" title={t.profile}>
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

        {/* Mobile: unread badge + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          {user && unreadCount > 0 && (
            <Link href="/inbox" onClick={close} className="relative flex items-center justify-center w-8 h-8 text-gray-600 dark:text-gray-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
              </svg>
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-600 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </Link>
          )}
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
            aria-label="Menu"
          >
            {menuOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div ref={menuRef} className="md:hidden border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 space-y-1">

          {/* Language + theme row */}
          <div className="flex items-center gap-2 pb-3 border-b border-gray-100 dark:border-gray-800">
            <button onClick={() => { setLang(lang === 'ka' ? 'en' : 'ka') }}
              className="flex-1 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium text-gray-700 dark:text-gray-300 text-center">
              {lang === 'ka' ? '🌐 EN' : '🌐 ქარ'}
            </button>
            <button onClick={toggleDark}
              className="flex-1 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300 text-center">
              {dark ? '☀️ ' + t.lightMode : '🌙 ' + t.darkMode}
            </button>
          </div>

          {user ? (
            <>
              {/* User identity */}
              <Link href="/profile" onClick={close} className="flex items-center gap-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg px-2 transition-colors">
                <PokerAvatar avatarId={avatar} size={32} />
                <span className="text-sm font-medium text-gray-900 dark:text-white">{t.profile}</span>
              </Link>

              <Link href="/new-post" onClick={close} className="flex items-center gap-3 py-2.5 px-2 rounded-lg bg-brand-600 hover:bg-brand-700 transition-colors">
                <span className="text-sm font-medium text-white">+ {t.newPost}</span>
              </Link>

              <Link href="/inbox" onClick={close} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                </svg>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.inbox}</span>
                {unreadCount > 0 && (
                  <span className="ml-auto px-1.5 py-0.5 bg-brand-600 text-white text-xs rounded-full font-bold">{unreadCount}</span>
                )}
              </Link>

              {isAdmin && (
                <Link href="/admin" onClick={close} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                  <span className="text-lg">⚙️</span>
                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Admin</span>
                </Link>
              )}

              <button onClick={handleLogout} className="w-full flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                </svg>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t.logout}</span>
              </button>
            </>
          ) : (
            <>
              <Link href="/auth?mode=login" onClick={close} className="flex items-center justify-center py-2.5 px-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t.login}</span>
              </Link>
              <Link href="/auth?mode=register" onClick={close} className="flex items-center justify-center py-2.5 px-4 rounded-lg bg-brand-600 hover:bg-brand-700 transition-colors">
                <span className="text-sm font-medium text-white">{t.register}</span>
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
