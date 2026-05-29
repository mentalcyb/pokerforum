'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'

function AuthForm() {
  const { t } = useApp()
  const router = useRouter()
  const params = useSearchParams()
  const [mode, setMode] = useState<'login' | 'register'>(params.get('mode') === 'register' ? 'register' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (mode === 'register') {
     const { data, error: err } = await supabase.auth.signUp({ email, password, options: { data: { username } } })
      if (err) { setError(t.registerError); setLoading(false); return }
      if (data.user) {
        await supabase.from('profiles').insert({ id: data.user.id, username })
      }
      setSuccess(t.confirmEmail)
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setError(t.loginError); setLoading(false); return }
      router.push('/')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center text-white text-3xl mx-auto mb-3">♠</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{mode === 'login' ? t.loginTitle : t.registerTitle}</h1>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8">
          {success && <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-sm">{success}</div>}
          {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.username}</label>
                <input
                  type="text" value={username} onChange={e => setUsername(e.target.value)} required
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.email}</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.password}</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm">
              {loading ? t.loading : (mode === 'login' ? t.login : t.register)}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-gray-500">
            {mode === 'login' ? t.noAccount : t.hasAccount}{' '}
            <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="text-brand-600 font-medium hover:underline">
              {mode === 'login' ? t.register : t.login}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return <Suspense><AuthForm /></Suspense>
}
