'use client'
import { useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import { createClient } from '@/lib/supabase'

/** Owner only: set a new password for a member who lost access (after checking who they are). */
export default function PasswordReset() {
  const { t } = useApp()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ username: string; email: string; password: string } | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function reset() {
    if (!name.trim() || !confirm(t.resetConfirm(name.trim()))) return
    setBusy(true); setMsg(null); setResult(null); setCopied(false)
    const { data } = await createClient().auth.getSession()
    const res = await fetch('/api/admin/reset-password', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: JSON.stringify({ username: name.trim() }),
    })
    const json = await res.json().catch(() => ({}))
    if (res.ok) { setResult(json); setName('') }
    else setMsg(json.error === 'not_found' ? t.resetNotFound : json.error === 'self' ? t.resetSelf : `⚠️ ${json.error}`)
    setBusy(false)
  }

  return (
    <div className="mb-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
      <div className="font-semibold text-gray-900 dark:text-white">🔑 {t.resetTitle}</div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">{t.resetHint}</p>
      <div className="flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && reset()} placeholder={t.testNickname}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white" />
        <button onClick={reset} disabled={busy || !name.trim()} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-50">{t.resetButton}</button>
      </div>
      {msg && <p className="mt-2 text-xs text-red-500">{msg}</p>}
      {result && (
        <div className="mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 text-sm">
          <div className="text-gray-700 dark:text-gray-300">{t.resetDone(result.username)}</div>
          {result.email && <div className="text-xs text-gray-500 mt-1">{t.resetEmail}: <b>{result.email}</b></div>}
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 font-mono text-base tracking-wider text-gray-900 dark:text-white">{result.password}</code>
            <button onClick={() => { navigator.clipboard.writeText(result.password).then(() => setCopied(true)).catch(() => {}) }}
              className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">{copied ? '✓' : '📋'}</button>
          </div>
          <p className="mt-2 text-xs text-gray-500">{t.resetAdvice}</p>
        </div>
      )}
    </div>
  )
}
