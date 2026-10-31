'use client'
import { useEffect, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import { createClient } from '@/lib/supabase'

type Role = 'member' | 'moderator' | 'admin'

/** On a member's profile: the owner can make them admin / moderator / regular member. Hidden for everyone else. */
export default function OwnerRoleControl({ userId }: { userId: string }) {
  const { t } = useApp()
  const [role, setRole] = useState<Role | null>(null)
  const [busy, setBusy] = useState(false)

  async function token() {
    const { data } = await createClient().auth.getSession()
    return data.session?.access_token ?? ''
  }

  useEffect(() => {
    token().then(async tk => {
      if (!tk) return
      const res = await fetch(`/api/admin/set-role?userId=${encodeURIComponent(userId)}`, { headers: { Authorization: `Bearer ${tk}` } })
      if (res.ok) setRole((await res.json()).role)
    })
  }, [userId])

  async function change(next: Role) {
    const names: Record<Role, string> = { member: t.role_member, moderator: t.role_moderator, admin: t.role_admin }
    if (next === role || !confirm(t.roleConfirm(names[next]))) return
    setBusy(true)
    const res = await fetch('/api/admin/set-role', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` },
      body: JSON.stringify({ userId, role: next }),
    })
    if (res.ok) setRole(next)
    setBusy(false)
  }

  if (!role) return null
  const btn = (r: Role, label: string) => (
    <button key={r} onClick={() => change(r)} disabled={busy}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-60 ${role === r ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
      {label}
    </button>
  )
  return (
    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400 mr-1">👑 {t.roleTitle}:</span>
      {btn('member', t.role_member)}
      {btn('moderator', `🛡️ ${t.role_moderator}`)}
      {btn('admin', `⚙️ ${t.role_admin}`)}
    </div>
  )
}
