'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useApp } from '@/contexts/AppContext'
import Link from 'next/link'
import PokerAvatar, { AVATARS, AvatarId } from '@/components/PokerAvatar'

export default function ProfilePage() {
  const { t } = useApp()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [avatar, setAvatar] = useState<AvatarId>('spade')
  const [signature, setSignature] = useState('')
  const [joinDate, setJoinDate] = useState('')
  const [postCount, setPostCount] = useState(0)
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setUserId(user.id)

      const [{ data: profile }, { count }] = await Promise.all([
        supabase.from('profiles').select('username, avatar, signature, created_at').eq('id', user.id).single(),
        supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      ])

      if (profile) {
        setUsername(profile.username || '')
        setNewUsername(profile.username || '')
        setAvatar((profile.avatar as AvatarId) || 'spade')
        setSignature(profile.signature || '')
        if (profile.created_at) {
          const d = new Date(profile.created_at)
          const day = d.getDate()
          const year = d.getFullYear()
          const months = ['იანვარი','თებერვალი','მარტი','აპრილი','მაისი','ივნისი','ივლისი','აგვისტო','სექტემბერი','ოქტომბერი','ნოემბერი','დეკემბერი']
          setJoinDate(`${day} ${months[d.getMonth()]} ${year}`)
        }
      }
      setPostCount(count ?? 0)
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setUsernameError(null)
    setSaving(true); setError(null)

    const trimmed = newUsername.trim()
    if (!trimmed) { setUsernameError('Username cannot be empty'); setSaving(false); return }
    if (trimmed.length < 3) { setUsernameError('Username must be at least 3 characters'); setSaving(false); return }

    // Check username taken (only if changed)
    if (trimmed !== username) {
      const { data: existing } = await supabase.from('profiles').select('id').eq('username', trimmed).neq('id', userId).single()
      if (existing) { setUsernameError('Username already taken'); setSaving(false); return }
    }

    const { error: err } = await supabase
      .from('profiles')
      .update({ avatar, signature, username: trimmed })
      .eq('id', userId)

    if (err) {
      setError(`${err.message} (code: ${err.code})`)
      setSaving(false)
      return
    }

    setUsername(trimmed)
    setSaving(false)
    window.dispatchEvent(new CustomEvent('avatar-updated', { detail: avatar }))
    router.push('/')
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-gray-400">{t.loading}</div>
  )

  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link href="/" className="text-brand-600 text-sm hover:underline mb-4 block">← {t.home}</Link>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
          <PokerAvatar avatarId={avatar} size={64} />
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-gray-900 dark:text-white truncate">{username}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{t.profileSettings}</div>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
            <div className="text-xs text-gray-400 mb-0.5">📅 {t.joinDate}</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">{joinDate || '—'}</div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3">
            <div className="text-xs text-gray-400 mb-0.5">📝 {t.postCountLabel}</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">{postCount}</div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t.username}
            </label>
            <input
              type="text"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              required
              minLength={3}
              maxLength={30}
              className={`${inputClass} ${usernameError ? 'border-red-400 focus:ring-red-400' : ''}`}
            />
            {usernameError && <p className="mt-1 text-xs text-red-500">{usernameError}</p>}
          </div>

          {/* Avatar picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              {t.chooseAvatar}
            </label>
            <div className="grid grid-cols-7 gap-2">
              {AVATARS.map(av => (
                <button
                  key={av.id}
                  type="button"
                  onClick={() => setAvatar(av.id)}
                  className={`relative rounded-xl p-0.5 transition-all ${
                    avatar === av.id
                      ? 'ring-2 ring-brand-600 ring-offset-2 dark:ring-offset-gray-900 scale-105'
                      : 'hover:scale-105 opacity-70 hover:opacity-100'
                  }`}
                  title={av.label}
                >
                  <PokerAvatar avatarId={av.id} size={44} />
                  {avatar === av.id && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-brand-600 rounded-full flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Signature */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t.signature}
            </label>
            <textarea
              value={signature}
              onChange={e => setSignature(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder={t.signaturePlaceholder}
              className={`${inputClass} resize-none`}
            />
            <div className="text-xs text-gray-400 text-right mt-1">{signature.length}/200</div>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm"
          >
            {saving ? t.loading : t.saveChanges}
          </button>
        </form>
      </div>
    </div>
  )
}
