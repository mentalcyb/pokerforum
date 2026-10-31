'use client'
import { useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import { createClient } from '@/lib/supabase'

/** Profile: change your password (asks for the current one first). */
export default function ChangePassword() {
  const { t } = useApp()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (next !== confirm) { setMsg({ ok: false, text: t.passwordMismatch }); return }
    if (next.length < 6) { setMsg({ ok: false, text: t.passwordTooShort }); return }
    setBusy(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    // check the current password, so nobody can change it on a phone left logged in
    const check = await supabase.auth.signInWithPassword({ email: user?.email ?? '', password: current })
    if (check.error) { setMsg({ ok: false, text: t.wrongCurrentPassword }); setBusy(false); return }
    const { error } = await supabase.auth.updateUser({ password: next })
    setBusy(false)
    if (error) { setMsg({ ok: false, text: error.message }); return }
    setMsg({ ok: true, text: t.passwordChangedShort })
    setCurrent(''); setNext(''); setConfirm('')
  }

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-sm font-medium text-brand-600 hover:underline">🔑 {t.changePassword}</button>
      ) : (
        <form onSubmit={save} className="space-y-3">
          <div className="font-medium text-sm text-gray-900 dark:text-white">🔑 {t.changePassword}</div>
          <input type="password" placeholder={t.currentPassword} value={current} onChange={e => setCurrent(e.target.value)} required className={inputClass} />
          <input type="password" placeholder={t.newPassword} value={next} onChange={e => setNext(e.target.value)} required minLength={6} className={inputClass} />
          <input type="password" placeholder={t.confirmPassword} value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={6} className={inputClass} />
          {msg && <p className={`text-sm ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{msg.text}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium rounded-lg text-sm">{busy ? t.loading : t.savePassword}</button>
            <button type="button" onClick={() => { setOpen(false); setMsg(null) }} className="px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300">{t.cancel}</button>
          </div>
        </form>
      )}
    </div>
  )
}
