'use client'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const { t, lang, setLang, dark, toggleDark } = useApp()
  const [user, setUser] = useState<User | null>(null)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <nav className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">♠</div>
          <span className="font-semibold text-gray-900 dark:text-white">{t.siteName}</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === 'ka' ? 'en' : 'ka')}
            className="px-2 py-1 text-sm rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium text-gray-700 dark:text-gray-300"
          >
            {lang === 'ka' ? 'EN' : 'ქარ'}
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDark}
            className="w-8 h-8 flex items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
            title={dark ? t.lightMode : t.darkMode}
          >
            {dark ? '☀️' : '🌙'}
          </button>

          {user ? (
            <>
              <Link href="/new-post" className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm rounded-lg transition-colors font-medium">
                + {t.newPost}
              </Link>
              <button onClick={handleLogout} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                {t.logout}
              </button>
            </>
          ) : (
            <>
              <Link href="/auth" className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
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
