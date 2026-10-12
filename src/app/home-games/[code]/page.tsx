'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useApp } from '@/contexts/AppContext'
import { createClient } from '@/lib/supabase'
import { homeGamesFetch } from '@/lib/poker/client'
import type { TableView } from '@/lib/poker/server'
import type { GameState, LogEntry, Player } from '@/lib/poker/engine'
import PlayingCard from '@/components/poker/PlayingCard'
import PokerAvatar from '@/components/PokerAvatar'

type T = ReturnType<typeof useApp>['t']

const POLL_REALTIME_MS = 10000
const POLL_FALLBACK_MS = 2500

function potTotal(s: GameState) {
  return s.seats.reduce((sum, p) => sum + (p ? p.committed : 0), 0)
}

function eligibleCount(s: GameState) {
  return s.seats.filter(p => p && !p.sittingOut && !p.leaving && p.stack > 0).length
}

function logLine(e: LogEntry, t: T): string {
  const n = e.name ?? ''
  const a = e.amount ?? 0
  switch (e.kind) {
    case 'street': {
      const label = e.street === 'flop' ? t.streetFlop : e.street === 'turn' ? t.streetTurn : t.streetRiver
      return `— ${label}: ${(e.cards ?? []).map(c => c.replace('T', '10')).join(' ')}`
    }
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
  const [tab, setTab] = useState<'log' | 'ledger'>('log')

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
            {t.hgBlinds}: {view.config.smallBlind}/{view.config.bigBlind}
            {s.handNo > 0 && <> · {t.hgHand(s.handNo)}</>}
            {' · '}<span className="text-amber-700 dark:text-amber-400">🪙 {t.hgPlayChips}</span>
          </div>
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
              <div className="flex gap-1 sm:gap-1.5 min-h-[3.5rem]">
                {s.board.map((c, i) => <PlayingCard key={i} card={c} size="md" />)}
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
              {s.phase === 'waiting' && (
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

            {/* Seats */}
            {s.seats.map((p, i) => {
              const pos = seatPos(i, { x: 44, y: 42 })
              if (!p) {
                const canSit = loggedIn && view.mySeat < 0 && !view.closed
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
                  <div className="flex -space-x-3 mb-[-10px] z-0 min-h-[1.5rem]">
                    {shown ? shown.map(c => <PlayingCard key={c} card={c} size="sm" />)
                      : myOwn ? view.myCards.map(c => <PlayingCard key={c} card={c} size="sm" />)
                      : showBacks ? [0, 1].map(k => <PlayingCard key={k} size="sm" />) : null}
                  </div>
                  <div className={`relative z-10 w-[5.5rem] sm:w-28 rounded-xl px-2 py-1.5 text-center shadow-lg border-2 transition-colors
                    ${isTurn ? 'border-amber-400 bg-gray-900' : winners.has(i) ? 'border-emerald-300 bg-gray-900' : 'border-gray-700 bg-gray-900/90'}
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
            {view.mySeat < 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                {loggedIn ? t.hgSpectating : <>{t.hgLoginRequired} <Link href="/auth?mode=login" className="text-brand-600 font-medium">{t.login}</Link></>}
              </p>
            ) : myTurn && me ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400">⏱ {t.hgYourTurn} · {Math.ceil(timeLeft / 1000)}{t.hgSeconds}</span>
                  <div className="flex gap-1">{view.myCards.map(c => <PlayingCard key={c} card={c} size="md" />)}</div>
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
                {view.myCards.length > 0 && me && !me.folded && (
                  <div className="flex gap-1 mr-2">{view.myCards.map(c => <PlayingCard key={c} card={c} size="md" />)}</div>
                )}
                {me && me.stack === 0 && !(s.phase === 'playing' && me.inHand && !me.folded) && (
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
                  ? <button onClick={() => send('start')} disabled={busy || eligibleCount(s) < 2} className={`${btn} bg-brand-600 hover:bg-brand-700 text-white`}>{t.hgStart}</button>
                  : s.paused
                    ? <button onClick={() => send('resume')} disabled={busy} className={`${btn} bg-brand-600 hover:bg-brand-700 text-white`}>{t.hgResume}</button>
                    : <button onClick={() => send('pause')} disabled={busy} className={`${btn} border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300`}>{t.hgPause}</button>}
                {s.paused && <span className="text-xs text-gray-500">{t.hgPausedNote}</span>}
                <button onClick={() => { if (confirm(t.hgConfirmClose)) send('close') }} disabled={busy || s.phase === 'playing'}
                  className="ml-auto text-xs text-red-600 hover:underline disabled:opacity-40">{t.hgCloseTable}</button>
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
            {(['log', 'ledger'] as const).map(k => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex-1 px-3 py-2.5 text-xs font-semibold ${tab === k ? 'text-brand-600 border-b-2 border-brand-600' : 'text-gray-500'}`}>
                {k === 'log' ? t.hgLog : t.hgLedger}
              </button>
            ))}
          </div>
          {tab === 'log' ? (
            <div className="max-h-[420px] overflow-y-auto px-4 py-3 space-y-1 text-xs">
              {s.log.slice().reverse().map((e, i) => (
                <div key={i} className={e.kind === 'win' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : e.kind === 'street' ? 'text-gray-400 pt-1' : 'text-gray-700 dark:text-gray-300'}>
                  {logLine(e, t)}
                </div>
              ))}
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
