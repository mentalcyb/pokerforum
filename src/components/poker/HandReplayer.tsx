'use client'
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '@/contexts/AppContext'
import { createClient } from '@/lib/supabase'
import { homeGamesFetch } from '@/lib/poker/client'
import type { HandRecord, LogEntry } from '@/lib/poker/engine'
import { handCategory } from '@/lib/poker/evaluate'
import PlayingCard from '@/components/poker/PlayingCard'
import PokerAvatar from '@/components/PokerAvatar'

type Hand = HandRecord & { id: number }

type Frame = {
  stacks: Record<number, number>
  bets: Record<number, number>
  pot: number
  board: string[]
  folded: number[]
  won: Record<number, number>
  actor?: number
  text: string
}

const STEP_MS = 1100

/** Turn a hand record into one picture of the table per action. */
function buildFrames(h: Hand, describe: (e: LogEntry) => string, intro: string): Frame[] {
  const stacks: Record<number, number> = {}
  for (const p of h.players) stacks[p.seat] = p.stack
  let bets: Record<number, number> = {}
  let pot = 0
  let board: string[] = []
  const folded: number[] = []
  const won: Record<number, number> = {}
  const collect = () => {
    pot += Object.values(bets).reduce((a, b) => a + b, 0)
    bets = {}
  }
  const snap = (text: string, actor?: number): Frame =>
    ({ stacks: { ...stacks }, bets: { ...bets }, pot, board: board.slice(), folded: folded.slice(), won: { ...won }, actor, text })

  const frames: Frame[] = [snap(intro)]
  for (const a of h.actions) {
    const s = a.seat ?? -1
    const amount = a.amount ?? 0
    switch (a.kind) {
      case 'blind':
      case 'call':
        bets[s] = (bets[s] ?? 0) + amount
        stacks[s] -= amount
        break
      case 'bet':
      case 'raise':
      case 'allin': { // amount is the player's total bet for the street
        const diff = amount - (bets[s] ?? 0)
        bets[s] = amount
        stacks[s] -= diff
        break
      }
      case 'fold':
        folded.push(s)
        break
      case 'street':
        collect()
        board = a.cards ?? board
        break
      case 'return':
        collect()
        pot -= amount
        stacks[s] += amount
        break
      case 'win':
        collect()
        pot -= amount
        stacks[s] += amount
        won[s] = (won[s] ?? 0) + amount
        break
      default:
        break
    }
    const text = describe(a)
    if (text) frames.push(snap(text, a.seat))
  }
  return frames
}

export default function HandReplayer({ code, fourColor, describe, onClose }: {
  code: string
  fourColor: boolean
  describe: (e: LogEntry) => string
  onClose: () => void
}) {
  const { t } = useApp()
  const [hands, setHands] = useState<Hand[] | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [viewerId, setViewerId] = useState<string | null>(null)
  const [selected, setSelected] = useState<number>(0)
  const [step, setStep] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => setViewerId(data.session?.user.id ?? null))
    homeGamesFetch<{ hands: Hand[]; unavailable?: boolean }>(`/${code}/hands`).then(res => {
      if (res.ok) { setHands(res.data.hands); setUnavailable(!!res.data.unavailable) }
      else setHands([])
    })
  }, [code])

  // close with Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const hand = hands?.[selected]
  const frames = useMemo(
    () => (hand ? buildFrames(hand, describe, `${t.hgHand(hand.handNo)} · ${t.hgBlinds}: ${hand.blinds.sb}/${hand.blinds.bb}`) : []),
    [hand, describe, t],
  )

  // new hand selected: start from the beginning and play automatically
  useEffect(() => { setStep(0); setPlaying(!!hand) }, [hand])

  useEffect(() => {
    if (!playing) return
    if (step >= frames.length - 1) { setPlaying(false); return }
    const id = setTimeout(() => setStep(v => v + 1), STEP_MS)
    return () => clearTimeout(id)
  }, [playing, step, frames.length])

  const frame = frames[Math.min(step, frames.length - 1)]
  const myPlayer = hand?.players.find(p => p.userId === viewerId)
  const base = myPlayer?.seat ?? hand?.players[0]?.seat ?? 0
  const n = hand?.maxSeats ?? 6
  const pos = (seat: number, r: { x: number; y: number }) => {
    const angle = ((90 + ((seat - base) * 360) / n) * Math.PI) / 180
    return { left: `${50 + r.x * Math.cos(angle)}%`, top: `${50 + r.y * Math.sin(angle)}%` }
  }
  const atEnd = frames.length > 0 && step >= frames.length - 1
  const btn = 'w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-bold text-gray-900 dark:text-white">🎬 {t.hgPrevHands}</h2>
          <button onClick={onClose} aria-label={t.trClose} className="w-8 h-8 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">✕</button>
        </div>

        {hands === null ? (
          <div className="p-10 text-center text-gray-400">{t.loading}</div>
        ) : unavailable ? (
          <div className="p-10 text-center text-sm text-gray-500">{t.hgHistoryNeedsSetup}</div>
        ) : hands.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">{t.hgNoHands}</div>
        ) : (
          <div className="flex flex-col md:flex-row min-h-0 flex-1">
            {/* Hand list */}
            <div className="md:w-56 flex-shrink-0 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 overflow-x-auto md:overflow-y-auto flex md:flex-col max-h-[30vh] md:max-h-none">
              {hands.map((h, i) => {
                const mine = h.players.find(p => p.userId === viewerId)
                const net = mine ? h.net[mine.seat] ?? 0 : null
                const winner = h.results[0]?.winners[0]?.name
                return (
                  <button key={h.id} onClick={() => setSelected(i)}
                    className={`text-left px-3 py-2.5 border-r md:border-r-0 md:border-b border-gray-50 dark:border-gray-800 flex-shrink-0 min-w-[150px] ${i === selected ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">#{h.handNo}</span>
                      {net !== null && (
                        <span className={`text-xs font-bold ${net > 0 ? 'text-emerald-600' : net < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {net > 0 ? '+' : ''}{net.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {new Date(h.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {winner && <> · 🏆 {winner}</>}
                    </div>
                    {mine && (h.cards[mine.seat] ?? []).length > 0 && (
                      <div className="text-[11px] text-gray-600 dark:text-gray-300 font-mono">{h.cards[mine.seat].map(c => c.replace('T', '10')).join(' ')}</div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Replay */}
            {hand && frame && (
              <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col gap-3 overflow-y-auto">
                <div className="relative w-full aspect-[4/3] sm:aspect-[16/9] select-none">
                  <div className="absolute inset-[10%_6%] rounded-[45%] bg-gradient-to-b from-emerald-700 to-emerald-900 border-8 border-amber-900/80 shadow-[inset_0_0_30px_rgba(0,0,0,0.45)]" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 pointer-events-none">
                    {frame.pot > 0 && <div className="px-2.5 py-0.5 rounded-full bg-black/40 text-white text-xs font-semibold">{t.hgPotLabel}: {frame.pot.toLocaleString()}</div>}
                    <div className="flex gap-1 min-h-[3.75rem]">
                      {frame.board.map((c, i) => <PlayingCard key={i} card={c} size="md" fourColor={fourColor} />)}
                    </div>
                  </div>
                  {hand.players.map(p => (frame.bets[p.seat] ?? 0) > 0 && (
                    <div key={`b${p.seat}`} className="absolute -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950 text-[10px] font-bold shadow" style={pos(p.seat, { x: 27, y: 25 })}>
                      {frame.bets[p.seat].toLocaleString()}
                    </div>
                  ))}
                  {hand.players.map(p => {
                    const cards = hand.cards[p.seat] ?? []
                    const isFolded = frame.folded.includes(p.seat)
                    const wonNow = frame.won[p.seat]
                    const handName = cards.length === 2 && frame.board.length >= 3 && !isFolded ? handCategory([...cards, ...frame.board]) : null
                    return (
                      <div key={p.seat} className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center" style={pos(p.seat, { x: 44, y: 41 })}>
                        <div className="flex -space-x-3 mb-[-10px] z-0">
                          {cards.length > 0
                            ? cards.map(c => <PlayingCard key={c} card={c} size="sm" fourColor={fourColor} dim={isFolded} />)
                            : !isFolded && [0, 1].map(k => <PlayingCard key={k} size="sm" />)}
                        </div>
                        <div className={`relative z-10 w-[5.25rem] sm:w-24 rounded-lg px-1.5 py-1 text-center border-2 ${
                          frame.actor === p.seat ? 'border-amber-400' : wonNow ? 'border-emerald-300' : 'border-gray-700'
                        } bg-gray-900 ${isFolded ? 'opacity-50' : ''}`}>
                          <div className="flex items-center justify-center gap-1">
                            <PokerAvatar avatarId={p.avatar} size={14} />
                            <span className={`text-[10px] sm:text-[11px] font-semibold truncate ${p.userId === viewerId ? 'text-amber-300' : 'text-white'}`}>{p.name}</span>
                          </div>
                          <div className="text-[10px] sm:text-[11px] font-bold text-emerald-300">{(frame.stacks[p.seat] ?? 0).toLocaleString()}</div>
                          {handName !== null && <div className="text-[9px] text-amber-300 truncate">{t.hgHandNames[handName]}</div>}
                          {hand.button === p.seat && <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-white text-gray-900 text-[9px] font-black flex items-center justify-center">D</span>}
                          {wonNow ? <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold whitespace-nowrap">+{wonNow.toLocaleString()}</span> : null}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Caption + controls */}
                <div className="text-center text-sm font-medium text-gray-800 dark:text-gray-200 min-h-[1.5rem]">{frame.text}</div>
                <div className="flex items-center justify-center gap-2">
                  <button className={btn} onClick={() => { setPlaying(false); setStep(0) }} disabled={step === 0} aria-label="⏮">⏮</button>
                  <button className={btn} onClick={() => { setPlaying(false); setStep(v => Math.max(0, v - 1)) }} disabled={step === 0} aria-label="◀">◀</button>
                  <button className={`${btn} w-14 bg-brand-600 border-brand-600 text-white hover:bg-brand-700`}
                    onClick={() => { if (atEnd) { setStep(0); setPlaying(true) } else setPlaying(v => !v) }}
                    aria-label={playing ? t.hgReplayPause : t.hgReplayPlay}>
                    {playing ? '⏸' : '▶'}
                  </button>
                  <button className={btn} onClick={() => { setPlaying(false); setStep(v => Math.min(frames.length - 1, v + 1)) }} disabled={atEnd} aria-label="▶">▶</button>
                  <button className={btn} onClick={() => { setPlaying(false); setStep(frames.length - 1) }} disabled={atEnd} aria-label="⏭">⏭</button>
                </div>
                <input type="range" min={0} max={Math.max(0, frames.length - 1)} value={step}
                  onChange={e => { setPlaying(false); setStep(Number(e.target.value)) }}
                  className="w-full accent-emerald-600" aria-label={t.hgReplayProgress} />
                <p className="text-[11px] text-center text-gray-400">{t.hgHistoryPrivacy}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
