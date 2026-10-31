'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import { createClient } from '@/lib/supabase'
import { OWNER_KEY } from '@/components/TestAccounts'

/** While the owner is inside a test account: a small bar to go back to their own account, no password. */
export default function OwnerReturnBar() {
  const { t } = useApp()
  const [saved, setSaved] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let rt: string | null = null
    try { rt = localStorage.getItem(OWNER_KEY) } catch {}
    if (!rt) return
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user?.app_metadata?.test_account) {
        // back in a normal account (e.g. logged in again by hand): the saved session isn't needed
        try { localStorage.removeItem(OWNER_KEY) } catch {}
        return
      }
      const { data: p } = await supabase.from('profiles').select('username').eq('id', data.user.id).single()
      setName(p?.username ?? '')
      setSaved(rt)
    })
  }, [])

  async function goBack() {
    if (!saved) return
    setBusy(true)
    const res = await fetch('/api/owner-return', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket: saved }),
    })
    const json = await res.json().catch(() => ({}))
    try { localStorage.removeItem(OWNER_KEY) } catch {}
    if (!res.ok || !json.token_hash) { window.location.href = '/auth?mode=login'; return }
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'local' })
    const { error } = await supabase.auth.verifyOtp({ token_hash: json.token_hash, type: 'magiclink' })
    window.location.href = error ? '/auth?mode=login' : '/admin'
  }

  if (!saved) return null
  return (
    <div className="fixed left-3 bottom-3 z-50 flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-900/95 text-white text-xs shadow-xl border border-gray-700">
      <span>🧪 {name}</span>
      <button onClick={goBack} disabled={busy} className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 font-semibold disabled:opacity-60">
        ↩️ {t.testBack}
      </button>
    </div>
  )
}
