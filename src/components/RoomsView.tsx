'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useApp } from '@/contexts/AppContext'
import { createClient } from '@/lib/supabase'
import { ROOMS, MAX_ROOMS_PER_USER } from '@/data/rooms'

type Votes = { counts: Record<string, number>; voters: number; mine: string[] }

const MEDALS = ['🥇', '🥈', '🥉']

export default function RoomsView() {
  const { t, lang } = useApp()
  const [votes, setVotes] = useState<Votes>({ counts: {}, voters: 0, mine: [] })
  const [token, setToken] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  async function load(tk: string | null) {
    const res = await fetch('/api/rooms/votes', { headers: tk ? { Authorization: `Bearer ${tk}` } : {} })
    const json: Votes = await res.json()
    setVotes(json)
    setPicked(json.mine)
    setLoaded(true)
  }

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      const tk = data.session?.access_token ?? null
      setToken(tk)
      load(tk)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle(id: string) {
    setMsg(null)
    setPicked(p => p.includes(id) ? p.filter(x => x !== id) : p.length >= MAX_ROOMS_PER_USER ? p : [...p, id])
  }

  async function save() {
    if (!token) return
    setSaving(true)
    try {
      const res = await fetch('/api/rooms/vote', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rooms: picked }),
      })
      if (res.ok) { setMsg(t.roomsSaved); await load(token) } else setMsg(t.networkError)
    } catch { setMsg(t.networkError) } finally { setSaving(false) }
  }

  const changed = [...picked].sort().join() !== [...votes.mine].sort().join()
  const ranked = [...ROOMS].sort((a, b) => (votes.counts[b.id] ?? 0) - (votes.counts[a.id] ?? 0))
  const pct = (id: string) => votes.voters ? Math.round(((votes.counts[id] ?? 0) / votes.voters) * 100) : 0

  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white text-xl">🃏</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t.roomsTitle}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t.roomsSubtitle}</p>
        </div>
      </div>

      {/* How to vote */}
      <div className="my-5 p-4 rounded-2xl border border-brand-200 dark:border-brand-900/50 bg-brand-50 dark:bg-brand-900/10 text-sm">
        {token ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-gray-700 dark:text-gray-300">{t.roomsPickHint(MAX_ROOMS_PER_USER)}</span>
            <button onClick={save} disabled={saving || !changed}
              className="ml-auto px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold">
              {saving ? t.loading : t.roomsSave}
            </button>
            {msg && <span className="w-full text-xs text-brand-700 dark:text-brand-300">{msg}</span>}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-gray-700 dark:text-gray-300">{t.roomsLoginHint}</span>
            <Link href="/auth?mode=login" className="ml-auto px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold">{t.login}</Link>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 mb-3">{t.roomsVoters(votes.voters)}</div>

      <div className="space-y-3">
        {ranked.map((r, i) => {
          const on = picked.includes(r.id)
          const p = pct(r.id)
          const hasVotes = (votes.counts[r.id] ?? 0) > 0
          return (
            <div key={r.id} className={`bg-white dark:bg-gray-900 rounded-2xl border p-4 transition ${on ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-gray-200 dark:border-gray-800'}`}>
              <div className="flex items-center gap-3">
                <span className="w-7 text-center text-lg">{hasVotes && i < 3 ? MEDALS[i] : <span className="text-sm text-gray-400">{i + 1}</span>}</span>
                <span className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: r.color }}>
                  {r.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 dark:text-white">{r.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 leading-snug">{lang === 'ka' ? r.ka : r.en}</div>
                </div>
                {token && (
                  <button onClick={() => toggle(r.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border ${on ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
                    {on ? `✓ ${t.roomsIPlay}` : t.roomsIPlay}
                  </button>
                )}
              </div>
              {loaded && (
                <div className="mt-3 flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${p}%` }} />
                  </div>
                  <span className="w-12 text-right text-xs font-semibold tabular-nums text-gray-600 dark:text-gray-300">{p}%</span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="mt-6 text-xs text-gray-400 leading-relaxed">
        {t.roomsNote}{' '}
        <a href="https://www.pokerscout.com/" target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-brand-600">PokerScout ↗</a>
      </p>
    </div>
  )
}
