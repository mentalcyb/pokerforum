'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import { createClient } from '@/lib/supabase'

type Account = { id: string; username: string; created_at: string }

export const OWNER_KEY = 'pf-owner-session'

/** Admin panel: create test accounts and enter them with one click (no password, nothing logged). */
export default function TestAccounts() {
  const { t } = useApp()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  async function call(method: 'GET' | 'POST', body?: object) {
    const { data } = await createClient().auth.getSession()
    const res = await fetch('/api/admin/test-accounts', {
      method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token ?? ''}` },
      body: body ? JSON.stringify(body) : undefined,
    })
    return { ok: res.ok, json: await res.json().catch(() => ({})) }
  }

  useEffect(() => { call('GET').then(r => r.ok && setAccounts(r.json.accounts ?? [])) }, [])

  async function create() {
    if (!name.trim()) return
    setBusy(true); setMsg(null)
    const r = await call('POST', { action: 'create', username: name.trim() })
    if (r.ok) { setAccounts(r.json.accounts); setName('') }
    else setMsg(r.json.error === 'taken' ? t.testTaken : `⚠️ ${r.json.error}`)
    setBusy(false)
  }

  async function enter(a: Account) {
    if (!confirm(t.testEnterConfirm(a.username))) return
    setBusy(true)
    const r = await call('POST', { action: 'login', id: a.id })
    if (!r.ok) { setMsg(`⚠️ ${r.json.error}`); setBusy(false); return }
    const supabase = createClient()
    // keep the owner's own session so the "back to my account" bar can return to it without a password
    const { data: own } = await supabase.auth.getSession()
    if (own.session) { try { localStorage.setItem(OWNER_KEY, own.session.refresh_token) } catch {} }
    await supabase.auth.signOut({ scope: 'local' })
    const { error } = await supabase.auth.verifyOtp({ token_hash: r.json.token_hash, type: 'magiclink' })
    if (error) { setMsg(`⚠️ ${error.message}`); setBusy(false); return }
    window.location.href = '/'
  }

  async function remove(a: Account) {
    if (!confirm(t.testDeleteConfirm(a.username))) return
    const r = await call('POST', { action: 'delete', id: a.id })
    if (r.ok) setAccounts(r.json.accounts)
  }

  return (
    <div className="mb-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
      <div className="font-semibold text-gray-900 dark:text-white">🧪 {t.testTitle}</div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">{t.testHint}</p>
      <div className="space-y-2">
        {accounts.map(a => (
          <div key={a.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 font-medium text-gray-900 dark:text-white truncate">{a.username}</span>
            <button onClick={() => enter(a)} disabled={busy} className="px-3 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold disabled:opacity-60">{t.testEnter}</button>
            <button onClick={() => remove(a)} disabled={busy} className="px-2 py-1 rounded-lg text-red-500 text-xs hover:bg-red-50 dark:hover:bg-red-900/20">✕</button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()} placeholder={t.testNickname}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white" />
        <button onClick={create} disabled={busy || !name.trim()} className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-sm font-semibold disabled:opacity-50">+ {t.testCreate}</button>
      </div>
      {msg && <p className="mt-2 text-xs text-red-500">{msg}</p>}
    </div>
  )
}
