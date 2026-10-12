'use client'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'
import { createClient } from '@/lib/supabase'
import { homeGamesFetch } from '@/lib/poker/client'
import type { TableView } from '@/lib/poker/server'
import type { GameState, LogEntry, Player } from '@/lib/poker/engine'
import { tournamentElapsed } from '@/lib/poker/engine'
import { handCategory } from '@/lib/poker/evaluate'
import PlayingCard from '@/components/poker/PlayingCard'
import PokerAvatar from '@/components/PokerAvatar'

type T = ReturnType<typeof useApp>['t']

const POLL_REALTIME_MS = 5000
const POLL_FALLBACK_MS = 2500

function potTotal(s: GameState) {
  return s.seats.reduce((sum, p) => sum + (p ? p.committed : 0), 0)
}

function eligibleCount(s: GameState) {
  return s.seats.filter(p => p && !p.sittingOut && !p.leaving && p.stack > 0).length
}

function readPref(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : v === '1'
  } catch { return fallback }
}

function writePref(key: string, value: boolean) {
  try { localStorage.setItem(key, value ? '1' : '0') } catch { /* storage unavailable */ }
}

/** Short two-tone chime, no audio file needed. */
/** Quick rattle of chips for the pot going to the winner. */
function playChips() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ac = new Ctx()
    for (let i = 0; i < 6; i++) {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'triangle'
      osc.frequency.value = 2200 + Math.random() * 1600
      osc.connect(gain)
      gain.connect(ac.destination)
      const t0 = ac.currentTime + 0.55 + i * 0.06 + Math.random() * 0.02
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05)
      osc.start(t0)
      osc.stop(t0 + 0.06)
    }
    setTimeout(() => ac.close(), 1500)
  } catch { /* audio unavailable */ }
}

const CHIP_COLORS = ['#ef4444', '#2563eb', '#16a34a', '#111827', '#f59e0b']

function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ac = new Ctx()
    ;[880, 1320].forEach((freq, i) => {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.frequency.value = freq
      osc.connect(gain)
      gain.connect(ac.destination)
      const t0 = ac.currentTime + i * 0.14
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18)
      osc.start(t0)
      osc.stop(t0 + 0.2)
    })
    setTimeout(() => ac.close(), 800)
  } catch { /* audio unavailable */ }
}

function logLine(e: LogEntry, t: T): string {
  const n = e.name ?? ''
  const a = e.amount ?? 0
  switch (e.kind) {
    case 'street': {
      const label = e.street === 'flop' ? t.streetFlop : e.street === 'turn' ? t.streetTurn : t.streetRiver
      return `— ${label}: ${(e.cards ?? []).map(c => c.replace('T', '10')).join(' ')}`
    }
    case 'level':
      return e.blinds ? t.hgLogLevel(e.place ?? 0, e.blinds.sb, e.blinds.bb) : ''
    case 'out':
      return t.hgLogOut(n, e.place ?? 0)
    case 'champion':
      return t.hgLogChampion(n)
    case 'show':
      return t.hgLogShow(n, (e.cards ?? []).map(c => c.replace('T', '10')).join(' '))
    case 'win':
      return t.hgLogText.win(n, a) + (e.hand !== undefined ? ` — ${t.hgHandNames[e.hand]}` : '')
    default: {
      const fn = (t.hgLogText as Record<string, (n: string, a: number) => string>)[e.kind]
      return fn ? fn(n, a) : e.kind
    }
  }
}

export default function HomeGameTablePage() {
  const { t } = useApp()
  const params = useParams()
  const code = String(params.code ?? '')

  const [view, setView] = useState<TableView | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loggedIn, setLoggedIn] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [realtime, setRealtime] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [raiseTo, setRaiseTo] = useState(0)
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<'chat' | 'log' | 'ledger'>('chat')
  const [fourColor, setFourColor] = useState(false)
  const [sound, setSound] = useState(true)
  const [chatText, setChatText] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [settingsForm, setSettingsForm] = useState({ smallBlind: '', bigBlind: '', turnSeconds: '' })
  const chatEnd = useRef<HTMLDivElement>(null)
  const wasMyTurn = useRef(false)
  const originalTitle = useRef<string | null>(null)

  const offset = useRef(0) // server clock − client clock
  const lastTick = useRef('')
  const versionRef = useRef(-1)

  const apply = useCallback((v: TableView) => {
    offset.current = v.serverTime - Date.now()
    // ignore responses that arrive out of order
    if (v.version < versionRef.current) return
    versionRef.current = v.version
    setView(v)
  }, [])

  const load = useCallback(async () => {
    const res = await homeGamesFetch<TableView>(`/${code}`)
    if (res.ok) apply(res.data)
    else if (res.status === 404) setNotFound(true)
  }, [code, apply])

  const send = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    if (action !== 'tick') setBusy(true)
    const res = await homeGamesFetch<TableView>(`/${code}/action`, { method: 'POST', body: { action, ...extra } })
    if (action !== 'tick') setBusy(false)
    if (res.ok) apply(res.data)
    else if (action !== 'tick') {
      setToast(t.hgErrors[res.error] ?? t.networkError)
      load()
    }
  }, [code, apply, load, t])

  // initial load + auth state
  useEffect(() => {
    load()
    createClient().auth.getSession().then(({ data }) => setLoggedIn(!!data.session))
  }, [load])

  // real-time updates (players and host), with polling as a safety net / for spectators
  const tableId = view?.id
  useEffect(() => {
    if (!tableId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`poker-table-${tableId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'poker_tables', filter: `id=eq.${tableId}` }, () => load())
      .subscribe(status => setRealtime(status === 'SUBSCRIBED'))
    return () => { supabase.removeChannel(channel) }
  }, [tableId, load])

  useEffect(() => {
    const id = setInterval(load, realtime ? POLL_REALTIME_MS : POLL_FALLBACK_MS)
    return () => clearInterval(id)
  }, [load, realtime])

  // Background tabs get their timers slowed down: refresh as soon as the player comes back.
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [load])

  // clock for timers
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [])

  // toast auto-hide
  useEffect(() => {
    if (!toast) return
    const id = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(id)
  }, [toast])

  // Ask the server to move on when a timer has run out (any client may do this; the server re-checks).
  const s = view?.state
  const serverNow = now + offset.current
  useEffect(() => {
    if (!s || view?.closed) return
    let key = ''
    if (s.phase === 'playing' && s.deadline && serverNow > s.deadline + 300) key = `d${s.deadline}`
    else if (s.phase === 'handOver' && s.nextHandAt && serverNow > s.nextHandAt + 200) key = `n${s.nextHandAt}`
    else if (s.phase === 'waiting' && s.started && !s.paused && eligibleCount(s) >= 2) key = `w${view!.version}`
    if (key && key !== lastTick.current) {
      lastTick.current = key
      send('tick')
    }
  }, [s, serverNow, view, send])

  // personal display preferences
  useEffect(() => {
    setFourColor(readPref('poker-4color', false))
    setSound(readPref('poker-sound', true))
  }, [])

  // alert the player when it becomes their turn: chime + tab title
  const isMyTurnNow = !!s && s.phase === 'playing' && view!.mySeat >= 0 && s.toAct === view!.mySeat
  useEffect(() => {
    if (isMyTurnNow && !wasMyTurn.current && sound) playChime()
    wasMyTurn.current = isMyTurnNow
    if (originalTitle.current === null) originalTitle.current = document.title
    document.title = isMyTurnNow ? t.hgTurnAlert : originalTitle.current
  }, [isMyTurnNow, sound, t])

  // put the page title back when leaving the table
  useEffect(() => () => { if (originalTitle.current !== null) document.title = originalTitle.current }, [])

  // Winning-pot animation: chips fly from the middle to each winner when a hand ends
  const [winAnim, setWinAnim] = useState<{ key: string; items: { seat: number; amount: number }[] } | null>(null)
  const lastAnimKey = useRef<string | null>(null)
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resultHandNo = s?.phase === 'handOver' ? s.lastResult?.handNo ?? null : null
  useEffect(() => {
    if (resultHandNo === null || !s?.lastResult) return
    const key = `${view!.id}-${resultHandNo}`
    // first load of the page: don't replay an old hand's animation
    if (lastAnimKey.current === null && view!.serverTime - (s.nextHandAt ?? 0) > -1000) { lastAnimKey.current = key; return }
    if (key === lastAnimKey.current) return
    lastAnimKey.current = key
    const totals = new Map<number, number>()
    for (const pot of s.lastResult.pots) for (const w of pot.winners) totals.set(w.seat, (totals.get(w.seat) ?? 0) + w.amount)
    setWinAnim({ key, items: Array.from(totals, ([seat, amount]) => ({ seat, amount })) })
    if (sound) playChips()
    if (animTimer.current) clearTimeout(animTimer.current)
    animTimer.current = setTimeout(() => setWinAnim(null), 3200)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultHandNo])
  useEffect(() => () => { if (animTimer.current) clearTimeout(animTimer.current) }, [])

  // keep the chat scrolled to the newest message
  const chatCount = s?.chat?.length ?? 0
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: 'nearest' }) }, [chatCount, tab])

  // reset the raise amount whenever the betting situation changes
  const me: Player | null = view && view.mySeat >= 0 ? view.state.seats[view.mySeat] : null
  const minTo = s && me ? Math.min(s.currentBet + s.minRaise, me.bet + me.stack) : 0
  useEffect(() => { setRaiseTo(minTo) }, [minTo, s?.handNo, s?.street])

  if (notFound) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-3">🃏</div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">{t.hgNotFound}</p>
        <Link href="/home-games" className="text-brand-600 text-sm font-medium">{t.hgBackToLobby}</Link>
      </div>
    )
  }
  if (!view || !s) return <div className="flex items-center justify-center min-h-[60vh] text-gray-400">{t.loading}</div>

  const n = s.seats.length
  const base = view.mySeat >= 0 ? view.mySeat : 0
  const myTurn = s.phase === 'playing' && s.toAct === view.mySeat && view.mySeat >= 0
  const toCall = me ? Math.max(0, s.currentBet - me.bet) : 0
  const maxTo = me ? me.bet + me.stack : 0
  const canRaise = !!me && !me.acted && me.stack > toCall
  const pot = potTotal(s)
  const potRaise = (fraction: number) => Math.max(minTo, Math.min(maxTo, s.currentBet + Math.floor((pot + toCall) * fraction)))
  const winners = new Set((s.phase === 'handOver' ? s.lastResult?.pots ?? [] : []).flatMap(p => p.winners.map(w => w.seat)))
  const timeLeft = s.deadline ? Math.max(0, s.deadline - serverNow) : 0
  const timePct = s.deadline ? Math.min(100, (timeLeft / (view.config.turnSeconds * 1000)) * 100) : 0
  const potInMiddle = s.seats.reduce((sum, p) => sum + (p ? p.committed - p.bet : 0), 0)
  const myHand = me && !me.folded && view.myCards.length === 2 ? handCategory([...view.myCards, ...s.board]) : null

  // Tournament clock
  const tour = s.tournament
  const tourRunning = !!tour && s.started && !tour.finished
  const blindsNow = s.blinds ?? { sb: view.config.smallBlind, bb: view.config.bigBlind }
  const levelMs = (tour?.levelMinutes ?? 10) * 60_000
  const nextLevelIn = tour && tour.startedAt !== null && tour.level < tour.levels.length - 1
    ? Math.max(0, (tour.level + 1) * levelMs - tournamentElapsed(tour, serverNow))
    : null
  const nextBlinds = tour && tour.level < tour.levels.length - 1 ? tour.levels[tour.level + 1] : null
  const playersLeft = s.seats.filter(p => p && p.stack + p.committed > 0).length
  const champion = tour?.finished ? tour.places.find(p => p.place === 1) : undefined
  const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`
  const startLabel = tour?.finished ? t.hgPlayAgain : t.hgStart

  function toggleFourColor() { setFourColor(v => { writePref('poker-4color', !v); return !v }) }
  function toggleSound() { setSound(v => { writePref('poker-sound', !v); return !v }) }

  function sendChat(e: React.FormEvent) {
    e.preventDefault()
    const text = chatText.trim()
    if (!text) return
    setChatText('')
    send('chat', { text })
  }

  function openSettings() {
    setSettingsForm({
      smallBlind: String(view!.config.smallBlind),
      bigBlind: String(view!.config.bigBlind),
      turnSeconds: String(view!.config.turnSeconds),
    })
    setShowSettings(v => !v)
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault()
    await send('settings', {
      smallBlind: Number(settingsForm.smallBlind),
      bigBlind: Number(settingsForm.bigBlind),
      turnSeconds: Number(settingsForm.turnSeconds),
    })
    setShowSettings(false)
  }

  function seatPos(i: number, r: { x: number; y: number }) {
    const angle = ((90 + ((i - base) * 360) / n) * Math.PI) / 180
    return { left: `${50 + r.x * Math.cos(angle)}%`, top: `${50 + r.y * Math.sin(angle)}%` }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard blocked: the link is visible anyway */ }
  }

  const btn = 'px-3 py-2 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50'

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <Link href="/home-games" className="text-xs text-gray-500 hover:text-brand-600">{t.hgBackToLobby}</Link>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">🃏 {view.name}</h1>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {tour && <span className="mr-1 font-semibold text-purple-600 dark:text-purple-300">🏆 {t.hgTournamentBadge} ·</span>}
            {tour && tourRunning && <>{t.hgLevel(tour.level + 1)} · </>}
            {t.hgBlinds}: {blindsNow.sb}/{blindsNow.bb}
            {tourRunning && nextLevelIn !== null && nextBlinds && (
              <> · {t.hgNextLevelIn}: <span className="font-mono font-semibold text-gray-700 dark:text-gray-200">{nextLevelIn > 0 ? mmss(nextLevelIn) : '0:00'}</span> ({nextBlinds.sb}/{nextBlinds.bb})</>
            )}
            {tourRunning && tour && <> · {t.hgPlayersLeft(playersLeft, tour.entrants)}</>}
            {s.handNo > 0 && <> · {t.hgHand(s.handNo)}</>}
            {' · '}<span className="text-amber-700 dark:text-amber-400">🪙 {t.hgPlayChips}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={toggleFourColor} title={t.hg4Color}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold ${fourColor ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'}`}>
            <span className={fourColor ? '' : 'text-gray-900 dark:text-gray-100'}>♠</span>
            <span className="text-red-500">♥</span>
            <span className={fourColor ? 'text-blue-200' : 'text-red-500'}>♦</span>
            <span className={fourColor ? 'text-green-200' : 'text-gray-900 dark:text-gray-100'}>♣</span>
            <span className="ml-1 hidden sm:inline">{t.hg4Color}</span>
          </button>
          <button onClick={toggleSound} title={t.hgSound}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs">{sound ? '🔔' : '🔕'}</button>
        </div>
        {!view.closed && (
          <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 max-w-full">
            <span className="text-xs text-gray-500 flex-shrink-0">{t.hgInvite}:</span>
            <code className="text-xs text-gray-700 dark:text-gray-300 truncate">pokerforum.ge/home-games/{view.code}</code>
            <button onClick={copyInvite} className="text-xs font-semibold text-brand-600 flex-shrink-0">{copied ? t.hgCopied : t.hgCopy}</button>
          </div>
        )}
      </div>

      {view.closed && (
        <div className="mb-4 p-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm text-gray-600 dark:text-gray-300 text-center">{t.hgClosed}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        <div>
          {/* Table */}
          <div className="relative w-full aspect-[4/5] sm:aspect-[16/10] mx-auto select-none">
            <div className="absolute inset-[9%_5%] sm:inset-[12%_9%] rounded-[45%] bg-gradient-to-b from-emerald-700 to-emerald-900 border-[10px] border-amber-900/80 shadow-[inset_0_0_40px_rgba(0,0,0,0.45)]" />

            {/* Board & pot */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 pointer-events-none">
              {(pot > 0 || potInMiddle > 0) && (
                <div className="px-3 py-1 rounded-full bg-black/40 text-white text-xs sm:text-sm font-semibold">
                  {t.hgPotLabel}: {pot.toLocaleString()}
                </div>
              )}
              <div className="flex gap-1 sm:gap-2 min-h-[4.5rem] sm:min-h-[5.5rem]">
                {s.board.map((c, i) => <PlayingCard key={i} card={c} size="lg" fourColor={fourColor} />)}
              </div>
              {s.phase === 'handOver' && s.lastResult && (
                <div className="px-3 py-1.5 rounded-lg bg-black/55 text-amber-300 text-xs sm:text-sm font-semibold text-center max-w-[80%]">
                  {s.lastResult.pots.map((p, i) => (
                    <div key={i}>
                      {p.winners.map(w => w.name).join(', ')} +{p.amount.toLocaleString()}
                      {p.hand !== null && <span className="text-white/80 font-normal"> — {t.hgHandNames[p.hand]}</span>}
                    </div>
                  ))}
                </div>
              )}
              {champion && (
                <div className="px-4 py-2 rounded-xl bg-amber-400 text-amber-950 text-sm sm:text-base font-bold text-center shadow-lg">
                  {t.hgChampionBanner(champion.name)}
                </div>
              )}
              {s.phase === 'waiting' && !champion && (
                <div className="px-3 py-1.5 rounded-lg bg-black/40 text-white/90 text-xs text-center max-w-[75%]">
                  {eligibleCount(s) < 2 ? t.hgWaitingPlayers : !s.started ? t.hgWaitingHost : s.paused ? t.hgPausedNote : t.hgNextHand}
                </div>
              )}
            </div>

            {/* Bets in front of players */}
            {s.seats.map((p, i) => p && p.bet > 0 ? (
              <div key={`bet${i}`} className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[11px] font-bold shadow"
                style={seatPos(i, { x: 27, y: 25 })}>
                {p.bet.toLocaleString()}
              </div>
            ) : null)}

            {/* Winning pot: chips fly to the winner(s), then "+amount" pops up */}
            {winAnim && winAnim.items.map(w => {
              const target = seatPos(w.seat, { x: 44, y: 42 })
              return (
                <Fragment key={`${winAnim.key}-${w.seat}`}>
                  {[0, 1, 2, 3, 4, 5].map(k => (
                    <div key={k} aria-hidden
                      className="pf-chip absolute z-20 w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-[3px] border-dashed border-white/80 shadow-md pointer-events-none"
                      style={{ background: CHIP_COLORS[k % CHIP_COLORS.length], animationDelay: `${k * 70}ms`, ['--x' as string]: target.left, ['--y' as string]: target.top } as React.CSSProperties} />
                  ))}
                  <div className="pf-win-amount absolute z-30 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-sm sm:text-base font-extrabold shadow-lg pointer-events-none whitespace-nowrap"
                    style={{ left: target.left, top: target.top }}>
                    +{w.amount.toLocaleString()}
                  </div>
                </Fragment>
              )
            })}

            {/* Seats */}
            {s.seats.map((p, i) => {
              const pos = seatPos(i, { x: 44, y: 42 })
              if (!p) {
                const canSit = loggedIn && view.mySeat < 0 && !view.closed && !tourRunning
                return (
                  <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2" style={pos}>
                    {canSit ? (
                      <button onClick={() => send('sit', { seat: i })} disabled={busy}
                        className="px-2.5 py-1.5 rounded-xl border-2 border-dashed border-white/50 bg-black/30 text-white text-[11px] sm:text-xs font-semibold hover:bg-black/50">
                        {t.hgSitHere}
                      </button>
                    ) : (
                      <div className="px-2.5 py-1.5 rounded-xl border border-white/20 bg-black/20 text-white/50 text-[11px]">{t.hgEmptySeat}</div>
                    )}
                  </div>
                )
              }
              const isTurn = s.phase === 'playing' && s.toAct === i
              const isMe = i === view.mySeat
              const shown = s.revealed[i]
              const showBacks = !isMe && p.inHand && !p.folded && !shown && (s.phase === 'playing' || s.phase === 'handOver')
              const myOwn = isMe && view.myCards.length > 0 && !p.folded
              return (
                <div key={i} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={pos}>
                  <div className="flex -space-x-4 mb-[-14px] z-0 min-h-[1.5rem]">
                    {shown ? shown.map(c => <PlayingCard key={c} card={c} size="md" fourColor={fourColor} />)
                      : myOwn ? view.myCards.map(c => <PlayingCard key={c} card={c} size="md" fourColor={fourColor} />)
                      : showBacks ? [0, 1].map(k => <PlayingCard key={k} size="md" />) : null}
                  </div>
                  <div className={`relative z-10 w-[5.5rem] sm:w-28 rounded-xl px-2 py-1.5 text-center shadow-lg border-2 transition-colors
                    ${isTurn ? 'border-amber-400 bg-gray-900' : winners.has(i) ? 'border-emerald-300 bg-gray-900' : 'border-gray-700 bg-gray-900/90'}
                    ${winAnim?.items.some(w => w.seat === i) ? 'pf-winner-glow' : ''}
                    ${p.folded || p.sittingOut ? 'opacity-55' : ''}`}>
                    <div className="flex items-center justify-center gap-1">
                      <PokerAvatar avatarId={p.avatar} size={16} />
                      <span className={`text-[11px] sm:text-xs font-semibold truncate ${isMe ? 'text-amber-300' : 'text-white'}`}>{p.name}</span>
                    </div>
                    <div className="text-[11px] sm:text-xs font-bold text-emerald-300">{p.stack.toLocaleString()}</div>
                    {(p.folded || p.sittingOut || p.allIn) && (
                      <div className="text-[9px] uppercase tracking-wide text-gray-400">
                        {p.allIn ? t.hgAllIn : p.sittingOut ? t.hgSittingOut : t.hgFolded}
                      </div>
                    )}
                    {shown && s.board.length >= 3 && (
                      <div className="mt-0.5 text-[10px] sm:text-[11px] font-semibold text-amber-300 truncate">
                        {t.hgHandNames[handCategory([...shown, ...s.board]) ?? 0]}
                      </div>
                    )}
                    {isTurn && s.deadline && (
                      <div className="absolute left-1 right-1 -bottom-1.5 h-1 rounded-full bg-gray-700 overflow-hidden">
                        <div className={`h-full ${timePct < 25 ? 'bg-red-500' : 'bg-amber-400'} transition-[width] duration-200`} style={{ width: `${timePct}%` }} />
                      </div>
                    )}
                    {s.button === i && s.handNo > 0 && (
                      <span title={t.hgDealer} className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-white text-gray-900 text-[10px] font-black flex items-center justify-center shadow">D</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Action bar */}
          <div className="mt-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 sm:p-4">
            {view.closed ? (
              <div className="flex flex-wrap items-center justify-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                <span>{t.hgClosed}</span>
                <Link href="/home-games" className={`${btn} bg-brand-600 hover:bg-brand-700 text-white`}>+ {t.hgNewTable}</Link>
              </div>
            ) : view.mySeat < 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                {loggedIn ? (tourRunning ? t.hgTournamentRunning : t.hgSpectating) : <>{t.hgLoginRequired} <Link href="/auth?mode=login" className="text-brand-600 font-medium">{t.login}</Link></>}
              </p>
            ) : myTurn && me ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400">⏱ {t.hgYourTurn} · {Math.ceil(timeLeft / 1000)}{t.hgSeconds}</span>
                  <div className="flex items-center gap-3">
                    {myHand !== null && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-right">{t.hgYourHand}:<br /><span className="text-sm font-bold text-amber-600 dark:text-amber-400">{t.hgHandNames[myHand]}</span></div>
                  )}
                    <div className="flex gap-1">{view.myCards.map(c => <PlayingCard key={c} card={c} size="lg" fourColor={fourColor} />)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => send('fold')} disabled={busy} className={`${btn} bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-300`}>{t.hgFold}</button>
                  {toCall === 0
                    ? <button onClick={() => send('check')} disabled={busy} className={`${btn} bg-sky-600 hover:bg-sky-700 text-white`}>{t.hgCheck}</button>
                    : <button onClick={() => send('call')} disabled={busy} className={`${btn} bg-sky-600 hover:bg-sky-700 text-white`}>{t.hgCall(Math.min(toCall, me.stack))}</button>}
                  <button onClick={() => send('raise', { amount: raiseTo })} disabled={busy || !canRaise}
                    className={`${btn} bg-brand-600 hover:bg-brand-700 text-white`}>
                    {raiseTo >= maxTo ? t.hgAllIn : `${s.currentBet === 0 ? t.hgBet : t.hgRaiseTo} ${raiseTo.toLocaleString()}`}
                  </button>
                </div>
                {canRaise && (
                  <div className="space-y-2">
                    <input type="range" min={minTo} max={maxTo} step={1} value={raiseTo}
                      onChange={e => setRaiseTo(Number(e.target.value))} className="w-full accent-emerald-600" />
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: t.hgMin, v: minTo },
                        { label: t.hgHalfPot, v: potRaise(0.5) },
                        { label: t.hgPot, v: potRaise(1) },
                        { label: t.hgAllIn, v: maxTo },
                      ].map(o => (
                        <button key={o.label} onClick={() => setRaiseTo(o.v)}
                          className="px-2.5 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-brand-400">{o.label}</button>
                      ))}
                      <input type="number" min={minTo} max={maxTo} value={raiseTo}
                        onChange={e => setRaiseTo(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                        className="w-24 px-2 py-1 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {!view.isHost && s.phase === 'waiting' && !s.started && (
                  <button onClick={() => send('start')} disabled={busy || eligibleCount(s) < 2}
                    className={`${btn} bg-brand-600 hover:bg-brand-700 text-white`}>{startLabel}</button>
                )}
                {view.myCards.length > 0 && me && (
                  <div className="flex items-center gap-3 mr-2">
                    <div className="flex gap-1">{view.myCards.map(c => <PlayingCard key={c} card={c} size="lg" fourColor={fourColor} dim={me.folded && !s.revealed[view.mySeat]} />)}</div>
                    {myHand !== null && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 ">{t.hgYourHand}:<br /><span className="text-sm font-bold text-amber-600 dark:text-amber-400">{t.hgHandNames[myHand]}</span></div>
                  )}
                  </div>
                )}
                {me && me.inHand && view.myCards.length > 0 && s.phase !== 'waiting' && !s.revealed[view.mySeat] && (
                  me.showCards
                    ? <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{t.hgWillShow}</span>
                    : <button onClick={() => send('show')} disabled={busy} className={`${btn} border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300`}>{t.hgShowCards}</button>
                )}
                {!tour && me && me.stack === 0 && !(s.phase === 'playing' && me.inHand && !me.folded) && (
                  <button onClick={() => send('rebuy')} disabled={busy} className={`${btn} bg-brand-600 hover:bg-brand-700 text-white`}>{t.hgRebuy(view.config.startingStack)}</button>
                )}
                {me && (me.sittingOut
                  ? <button onClick={() => send('sitIn')} disabled={busy} className={`${btn} bg-sky-600 hover:bg-sky-700 text-white`}>{t.hgSitIn}</button>
                  : <button onClick={() => send('sitOut')} disabled={busy} className={`${btn} border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300`}>{t.hgSitOut}</button>)}
                <button onClick={() => { if (confirm(t.hgConfirmLeave)) send('leave') }} disabled={busy}
                  className={`${btn} border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300`}>{t.hgLeave}</button>
              </div>
            )}

            {/* Host controls */}
            {view.isHost && !view.closed && (
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">{t.hgHostBadge}</span>
                {!s.started || (s.phase === 'waiting' && !s.paused)
                  ? <button onClick={() => send('start')} disabled={busy || eligibleCount(s) < 2} className={`${btn} bg-brand-600 hover:bg-brand-700 text-white`}>{startLabel}</button>
                  : s.paused
                    ? <button onClick={() => send('resume')} disabled={busy} className={`${btn} bg-brand-600 hover:bg-brand-700 text-white`}>{t.hgResume}</button>
                    : <button onClick={() => send('pause')} disabled={busy} className={`${btn} border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300`}>{t.hgPause}</button>}
                {s.paused && <span className="text-xs text-gray-500">{t.hgPausedNote}</span>}
                <button onClick={openSettings} className={`${btn} border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300`}>⚙️ {t.hgSettings}</button>
                <button onClick={() => { if (confirm(t.hgConfirmClose)) send('close') }} disabled={busy || s.phase === 'playing'}
                  className="ml-auto text-xs text-red-600 hover:underline disabled:opacity-40">{t.hgCloseTable}</button>
              </div>
            )}

            {view.isHost && !view.closed && showSettings && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 grid gap-4 sm:grid-cols-2">
                <form onSubmit={saveSettings} className="space-y-2">
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t.hgSettings}</div>
                  <div className="flex flex-wrap items-end gap-2">
                    {(tour && s.started
                      ? ([['turnSeconds', `${t.hgTurnTime} (${t.hgSeconds})`]] as const)
                      : ([
                        ['smallBlind', 'SB'],
                        ['bigBlind', 'BB'],
                        ['turnSeconds', `${t.hgTurnTime} (${t.hgSeconds})`],
                      ] as const)).map(([key, label]) => (
                      <label key={key} className="text-[11px] text-gray-500">
                        {label}
                        <input type="number" min={1} value={settingsForm[key]}
                          onChange={e => setSettingsForm(f => ({ ...f, [key]: e.target.value }))}
                          className="block w-24 mt-0.5 px-2 py-1 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                      </label>
                    ))}
                    <button type="submit" disabled={busy || s.phase === 'playing'} className={`${btn} bg-brand-600 hover:bg-brand-700 text-white`}>{t.save}</button>
                  </div>
                  <p className="text-[11px] text-gray-400">{tour && s.started ? t.hgBlindsLocked : t.hgSettingsHint}</p>
                </form>
                <div>
                  <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{t.hgPlayersList}</div>
                  <div className="space-y-1">
                    {s.seats.map((p, i) => p && (
                      <div key={i} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate text-gray-800 dark:text-gray-200">{p.name} <span className="text-xs text-gray-400">{p.stack.toLocaleString()}</span></span>
                        {i !== view.mySeat && (
                          <button onClick={() => { if (confirm(t.hgConfirmKick(p.name))) send('kick', { seat: i }) }} disabled={busy}
                            className="text-xs font-semibold text-red-600 hover:underline">{t.hgKick}</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          {!view.closed && view.isHost && s.handNo === 0 && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t.hgShare}</p>
          )}
        </div>

        {/* Side panel: history & settlement */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden h-fit">
          <div className="flex border-b border-gray-100 dark:border-gray-800">
            {(['chat', 'log', 'ledger'] as const).map(k => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex-1 px-3 py-2.5 text-xs font-semibold ${tab === k ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500'}`}>
                {k === 'chat' ? `💬 ${t.hgChat}` : k === 'log' ? t.hgLog : tour ? `🏆 ${t.hgStandings}` : t.hgLedger}
              </button>
            ))}
          </div>
          {tab === 'chat' ? (
            <div className="flex flex-col h-[420px]">
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5 text-sm">
                {(s.chat ?? []).length === 0 && <p className="text-xs text-gray-400 text-center mt-6">{t.hgNoChat}</p>}
                {(s.chat ?? []).map((m, i) => (
                  <div key={i} className="break-words">
                    <span className={`font-semibold ${m.userId === me?.userId ? 'text-amber-600 dark:text-amber-400' : 'text-brand-600'}`}>{m.name}:</span>{' '}
                    <span className="text-gray-800 dark:text-gray-200">{m.text}</span>
                  </div>
                ))}
                <div ref={chatEnd} />
              </div>
              {(view.mySeat >= 0 || view.isHost) && !view.closed && (
                <form onSubmit={sendChat} className="flex gap-1.5 p-2 border-t border-gray-100 dark:border-gray-800">
                  <input value={chatText} onChange={e => setChatText(e.target.value)} maxLength={200} placeholder={t.hgChatPlaceholder}
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <button type="submit" disabled={!chatText.trim()} className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50">{t.hgSend}</button>
                </form>
              )}
            </div>
          ) : tab === 'log' ? (
            <div className="max-h-[420px] overflow-y-auto px-4 py-3 space-y-1 text-xs">
              {s.log.slice().reverse().map((e, i) => (
                <div key={i} className={e.kind === 'win' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : e.kind === 'street' ? 'text-gray-400 pt-1' : 'text-gray-700 dark:text-gray-300'}>
                  {logLine(e, t)}
                </div>
              ))}
            </div>
          ) : tour ? (
            <div className="px-4 py-3 text-sm">
              <table className="w-full text-xs">
                <tbody>
                  {s.seats
                    .filter((p): p is Player => !!p && (tourRunning || !!tour.finished))
                    .sort((a, b) => (b.stack + b.committed) - (a.stack + a.committed))
                    .filter(p => !tour.places.some(pl => pl.userId === p.userId))
                    .map(p => (
                      <tr key={p.userId} className="border-t border-gray-50 dark:border-gray-800">
                        <td className="py-1.5 w-8 text-gray-400">—</td>
                        <td className="py-1.5 text-gray-800 dark:text-gray-200 truncate max-w-[120px]">{p.name}</td>
                        <td className="py-1.5 text-right font-semibold text-emerald-600">{(p.stack + p.committed).toLocaleString()}</td>
                      </tr>
                    ))}
                  {tour.places.slice().sort((a, b) => a.place - b.place).map(pl => (
                    <tr key={pl.userId + pl.place} className="border-t border-gray-50 dark:border-gray-800">
                      <td className="py-1.5 w-8 font-bold text-gray-700 dark:text-gray-200">{pl.place === 1 ? '🏆' : `#${pl.place}`}</td>
                      <td className="py-1.5 text-gray-800 dark:text-gray-200 truncate max-w-[120px]">{pl.name}</td>
                      <td className="py-1.5 text-right text-gray-400">{pl.place === 1 ? '' : '❌'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 text-[11px] text-gray-500 dark:text-gray-400">
                <div className="font-semibold mb-1">{t.hgStructure} ({tour.levelMinutes} {t.hgMinutes})</div>
                <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
                  {tour.levels.slice(0, 15).map((l, i) => (
                    <span key={i} className={i === tour.level && tourRunning ? 'font-bold text-purple-600 dark:text-purple-300' : ''}>
                      {i + 1}. {l.sb}/{l.bb}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 py-3">
              <p className="text-[11px] text-gray-400 mb-2">{t.hgLedgerHint}</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 text-left">
                    <th className="font-medium py-1"></th>
                    <th className="font-medium py-1 text-right">{t.hgBoughtIn}</th>
                    <th className="font-medium py-1 text-right">{t.hgNow}</th>
                    <th className="font-medium py-1 text-right">{t.hgNet}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(s.ledger).map(([uid, e]) => {
                    const seated = s.seats.find(p => p?.userId === uid)
                    const nowChips = e.cashedOut + (seated ? seated.stack + seated.committed : 0)
                    const net = nowChips - e.boughtIn
                    return (
                      <tr key={uid} className="border-t border-gray-50 dark:border-gray-800">
                        <td className="py-1.5 text-gray-800 dark:text-gray-200 truncate max-w-[90px]">{e.name}</td>
                        <td className="py-1.5 text-right text-gray-500">{e.boughtIn.toLocaleString()}</td>
                        <td className="py-1.5 text-right text-gray-700 dark:text-gray-300">{nowChips.toLocaleString()}</td>
                        <td className={`py-1.5 text-right font-semibold ${net > 0 ? 'text-emerald-600' : net < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {net > 0 ? '+' : ''}{net.toLocaleString()}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm shadow-xl">{toast}</div>
      )}
    </div>
  )
}
