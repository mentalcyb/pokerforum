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
  const [avatar, setAvatar] = useState<AvatarId>('spade')
  const [signature, setSignature] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setUserId(user.id)
      const { data: profile } = await supabase
        .from('profiles').select('username, avatar, signature').eq('id', user.id).single()
      if (profile) {
        setUsername(profile.username || '')
        setAvatar((profile.avatar as AvatarId) || 'spade')
        setSignature(profile.signature || '')
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setSaving(true); setError(null)

    const { error: err } = await supabase
      .from('profiles')
      .update({ avatar, signature })
      .eq('id', userId)

    if (err) {
      setError(`${err.message} (code: ${err.code})`)
      setSaving(false)
      return
    }

    setSaving(false)
    window.dispatchEvent(new CustomEvent('avatar-updated', { detail: avatar }))
    router.push('/')
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen text-gray-400">{t.loading}</div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link href="/" className="text-brand-600 text-sm hover:underline mb-4 block">← {t.home}</Link>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
          <PokerAvatar avatarId={avatar} size={64} />
          <div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">{username}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{t.profileSettings}</div>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
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
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
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
