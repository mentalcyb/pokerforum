'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'
import { createClient } from '@/lib/supabase'
import { homeGamesFetch } from '@/lib/poker/client'

type TableSummary = {
  code: string
  name: string
  isHost: boolean
  config: { smallBlind: number; bigBlind: number; startingStack: number; maxSeats: number; turnSeconds: number }
  players: number
  phase: string
}

const BLIND_OPTIONS = [
  [1, 2], [5, 10], [10, 20], [25, 50], [50, 100],
] as const
const STACK_IN_BB = [50, 100, 200] as const
const SEAT_OPTIONS = [2, 4, 6, 8, 9] as const
const TIMER_OPTIONS = [15, 30, 45, 60] as const

export default function HomeGamesLobby() {
  const { t } = useApp()
  const router = useRouter()
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [tables, setTables] = useState<TableSummary[]>([])
  const [name, setName] = useState('')
  const [blinds, setBlinds] = useState(1) // index into BLIND_OPTIONS
  const [stackBB, setStackBB] = useState<number>(100)
  const [seats, setSeats] = useState<number>(6)
  const [timer, setTimer] = useState<number>(30)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      setLoggedIn(!!data.session)
      if (data.session) loadTables()
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadTables() {
    const res = await homeGamesFetch<{ tables: TableSummary[] }>('')
    if (res.ok) setTables(res.data.tables)
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setError(null)
    const [sb, bb] = BLIND_OPTIONS[blinds]
    const res = await homeGamesFetch<{ code: string }>('', {
      method: 'POST',
      body: { name, smallBlind: sb, bigBlind: bb, startingStack: bb * stackBB, maxSeats: seats, turnSeconds: timer },
    })
    setCreating(false)
    if (!res.ok) { setError(t.hgErrors[res.error] ?? t.loadError); return }
    router.push(`/home-games/${res.data.code}`)
  }

  const chip = (active: boolean) =>
    `px-3 py-1.5 text-sm rounded-lg border transition-colors ${active
      ? 'bg-brand-600 border-brand-600 text-white'
      : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-400'}`

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white text-xl">🃏</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t.hgTitle}</h1>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t.hgSubtitle}</p>
      <p className="text-xs text-amber-700 dark:text-amber-400 mb-6">🪙 {t.hgPlayChips}</p>

      {loggedIn === false && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{t.hgLoginRequired}</p>
          <div className="flex justify-center gap-2">
            <Link href="/auth?mode=login" className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">{t.login}</Link>
            <Link href="/auth?mode=register" className="px-4 py-2 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium">{t.register}</Link>
          </div>
        </div>
      )}

      {loggedIn && (
        <>
          <form onSubmit={create} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mb-6 space-y-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">{t.hgCreateTitle}</h2>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{t.hgTableName}</label>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder={t.hgTableNamePlaceholder}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{t.hgBlinds}</div>
              <div className="flex flex-wrap gap-1.5">
                {BLIND_OPTIONS.map(([sb, bb], i) => (
                  <button type="button" key={bb} onClick={() => setBlinds(i)} className={chip(blinds === i)}>{sb}/{bb}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{t.hgStartingStack}</div>
              <div className="flex flex-wrap gap-1.5">
                {STACK_IN_BB.map(n => (
                  <button type="button" key={n} onClick={() => setStackBB(n)} className={chip(stackBB === n)}>
                    {(BLIND_OPTIONS[blinds][1] * n).toLocaleString()} <span className="opacity-70">({n} BB)</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{t.hgSeats}</div>
                <div className="flex flex-wrap gap-1.5">
                  {SEAT_OPTIONS.map(n => <button type="button" key={n} onClick={() => setSeats(n)} className={chip(seats === n)}>{n}</button>)}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">{t.hgTurnTime}</div>
                <div className="flex flex-wrap gap-1.5">
                  {TIMER_OPTIONS.map(n => <button type="button" key={n} onClick={() => setTimer(n)} className={chip(timer === n)}>{n}{t.hgSeconds}</button>)}
                </div>
              </div>
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" disabled={creating}
              className="w-full py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
              {creating ? t.hgCreating : t.hgCreate}
            </button>
          </form>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white">{t.hgMyTables}</h2>
            </div>
            {tables.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400">{t.hgNoTables}</div>
            ) : tables.map(tb => (
              <Link key={tb.code} href={`/home-games/${tb.code}`}
                className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {tb.name}
                    {tb.isHost && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">{t.hgHostBadge}</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {tb.config.smallBlind}/{tb.config.bigBlind} · {t.hgPlayers(tb.players)} / {tb.config.maxSeats}
                  </div>
                </div>
                <span className="text-xs font-semibold text-brand-600">{t.hgOpen} →</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
