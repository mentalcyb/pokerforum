'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'

/** Opened from the "reset your password" e-mail: set a new password. */
export default function ResetPasswordPage() {
  const { t } = useApp()
  const router = useRouter()
  const [ready, setReady] = useState<'checking' | 'ok' | 'invalid'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')
    const tokenHash = url.searchParams.get('token_hash')
    let settled = false
    const finish = (ok: boolean) => { if (!settled) { settled = true; setReady(ok ? 'ok' : 'invalid') } }
    // the recovery session can also arrive through the client's own URL handling
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) finish(true)
    })
    ;(async () => {
      try {
        // works on any device: link with ?token_hash=… (see the e-mail template)
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
          if (!error) return finish(true)
        }
        // ?code=… (only works in the browser that asked for the link)
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (!error) return finish(true)
        }
        // give the client a moment if it is still processing the link itself
        for (let i = 0; i < 8 && !settled; i++) {
          const { data } = await supabase.auth.getSession()
          if (data.session) return finish(true)
          await new Promise(r => setTimeout(r, 400))
        }
        finish(false)
      } catch {
        finish(false)
      }
    })()
    return () => sub.subscription.unsubscribe()
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError(t.passwordMismatch); return }
    setLoading(true); setError('')
    const { error: err } = await createClient().auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => router.push('/'), 1500)
  }

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center text-white text-3xl mx-auto mb-3">🔑</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.newPasswordTitle}</h1>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-8">
          {ready === 'checking' && <p className="text-center text-sm text-gray-500">{t.loading}</p>}
          {ready === 'invalid' && (
            <div className="text-sm text-center">
              <p className="text-red-600 dark:text-red-400 mb-4">{t.resetLinkInvalid}</p>
              <a href="/auth?mode=login" className="text-brand-600 hover:underline">{t.backToLogin}</a>
            </div>
          )}
          {ready === 'ok' && (done ? (
            <p className="text-center text-sm text-green-600 dark:text-green-400">{t.passwordChanged}</p>
          ) : (
            <form onSubmit={save} className="space-y-4">
              {error && <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg text-sm">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.newPassword}</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className={inputClass} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.confirmPassword}</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={6} className={inputClass} />
              </div>
              <button type="submit" disabled={loading} className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm">
                {loading ? t.loading : t.savePassword}
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  )
}
