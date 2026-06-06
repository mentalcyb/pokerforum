'use client'
import { useState, useCallback } from 'react'

// ── Card types & utilities ─────────────────────────────────────────────────

type Suit = 'h' | 'd' | 'c' | 's'
type Card = { rank: number; suit: Suit }

const RANK_MAP: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
}
const RANK_LABEL: Record<number, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9',
  10: 'T', 11: 'J', 12: 'Q', 13: 'K', 14: 'A',
}
const SUIT_SYMBOL: Record<Suit, string> = { h: '♥', d: '♦', c: '♣', s: '♠' }
const SUIT_COLOR: Record<Suit, string> = {
  h: 'text-red-600', d: 'text-red-600', c: 'text-gray-800 dark:text-gray-200', s: 'text-gray-800 dark:text-gray-200',
}

function parseCard(s: string): Card | null {
  if (!s || s.length < 2) return null
  const rankStr = s.slice(0, -1).toUpperCase()
  const suitStr = s.slice(-1).toLowerCase() as Suit
  const rank = RANK_MAP[rankStr]
  if (!rank || !['h', 'd', 'c', 's'].includes(suitStr)) return null
  return { rank, suit: suitStr }
}

function cardKey(c: Card) { return `${c.rank}${c.suit}` }

function buildDeck(): Card[] {
  const deck: Card[] = []
  for (const suit of ['h', 'd', 'c', 's'] as Suit[])
    for (let rank = 2; rank <= 14; rank++)
      deck.push({ rank, suit })
  return deck
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── Hand evaluation ────────────────────────────────────────────────────────

function compareLex(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

function eval5(cards: Card[]): number[] {
  const ranks = cards.map(c => c.rank).sort((a, b) => b - a)
  const suits = cards.map(c => c.suit)
  const cnt: Record<number, number> = {}
  for (const r of ranks) cnt[r] = (cnt[r] ?? 0) + 1
  const groups = Object.entries(cnt)
    .map(([r, c]) => ({ r: Number(r), c }))
    .sort((a, b) => b.c - a.c || b.r - a.r)

  const isFlush = new Set(suits).size === 1
  const uniq = groups.map(g => g.r)

  let isStraight = false, straightHigh = 0
  if (uniq.length === 5) {
    if (uniq[0] - uniq[4] === 4) { isStraight = true; straightHigh = uniq[0] }
    if (uniq[0] === 14 && uniq[1] === 5 && uniq[2] === 4 && uniq[3] === 3 && uniq[4] === 2) {
      isStraight = true; straightHigh = 5
    }
  }

  if (isFlush && isStraight) return [8, straightHigh]
  if (groups[0].c === 4) return [7, groups[0].r, groups[1].r]
  if (groups[0].c === 3 && groups[1].c === 2) return [6, groups[0].r, groups[1].r]
  if (isFlush) return [5, ...ranks]
  if (isStraight) return [4, straightHigh]
  if (groups[0].c === 3) return [3, groups[0].r, ...groups.slice(1).map(g => g.r)]
  if (groups[0].c === 2 && groups[1].c === 2)
    return [2, groups[0].r, groups[1].r, groups[2].r]
  if (groups[0].c === 2) return [1, groups[0].r, ...groups.slice(1).map(g => g.r)]
  return [0, ...ranks]
}

function bestHoldem(hole: Card[], board: Card[]): number[] {
  const all = [...hole, ...board]
  let best: number[] | null = null
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const five = all.filter((_, k) => k !== i && k !== j)
      const val = eval5(five)
      if (!best || compareLex(val, best) > 0) best = val
    }
  return best!
}

function bestOmaha(hole: Card[], board: Card[]): number[] {
  let best: number[] | null = null
  for (let i = 0; i < 4; i++)
    for (let j = i + 1; j < 4; j++)
      for (let bi = 0; bi < board.length; bi++)
        for (let bj = bi + 1; bj < board.length; bj++)
          for (let bk = bj + 1; bk < board.length; bk++) {
            const five = [hole[i], hole[j], board[bi], board[bj], board[bk]]
            const val = eval5(five)
            if (!best || compareLex(val, best) > 0) best = val
          }
  return best!
}

// ── Monte Carlo simulation ─────────────────────────────────────────────────

type SimResult = { wins: number; ties: number; total: number }

function simulate(
  game: 'holdem' | 'omaha',
  players: Card[][],
  board: Card[],
  iters = 5000,
): SimResult[] {
  const used = new Set([...players.flat(), ...board].map(cardKey))
  const deck = buildDeck().filter(c => !used.has(cardKey(c)))
  const need = 5 - board.length
  const results: SimResult[] = players.map(() => ({ wins: 0, ties: 0, total: iters }))

  for (let iter = 0; iter < iters; iter++) {
    shuffle(deck)
    const runout = deck.slice(0, need)
    const fullBoard = [...board, ...runout]

    const vals = players.map(p =>
      game === 'holdem' ? bestHoldem(p, fullBoard) : bestOmaha(p, fullBoard),
    )

    let bestVal = vals[0]
    for (const v of vals) if (compareLex(v, bestVal) > 0) bestVal = v

    const winners = vals
      .map((v, i) => ({ i, tie: compareLex(v, bestVal) === 0 }))
      .filter(x => x.tie)
      .map(x => x.i)

    if (winners.length === 1) results[winners[0]].wins++
    else winners.forEach(i => results[i].ties++)
  }

  return results
}

// ── Card picker UI component ───────────────────────────────────────────────

const ALL_RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']
const ALL_SUITS = ['s', 'h', 'd', 'c'] as Suit[]

function CardPicker({
  selected,
  onChange,
  blocked,
  maxCards,
  label,
}: {
  selected: Card[]
  onChange: (cards: Card[]) => void
  blocked: Set<string>
  maxCards: number
  label: string
}) {
  const selectedKeys = new Set(selected.map(cardKey))

  function toggle(c: Card) {
    const k = cardKey(c)
    if (selectedKeys.has(k)) {
      onChange(selected.filter(x => cardKey(x) !== k))
    } else if (selected.length < maxCards && !blocked.has(k)) {
      onChange([...selected, c])
    }
  }

  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{label}</div>
      <div className="flex flex-wrap gap-0.5">
        {ALL_SUITS.map(suit =>
          ALL_RANKS.map(rankStr => {
            const rank = RANK_MAP[rankStr]
            const c = { rank, suit }
            const k = cardKey(c)
            const isSelected = selectedKeys.has(k)
            const isBlocked = !isSelected && (blocked.has(k) || (!isSelected && selected.length >= maxCards))
            return (
              <button
                key={k}
                onClick={() => toggle(c)}
                disabled={isBlocked}
                className={`w-8 h-9 text-xs font-bold rounded border transition-all flex flex-col items-center justify-center leading-none
                  ${isSelected
                    ? 'bg-brand-600 border-brand-600 text-white shadow-md scale-105'
                    : isBlocked
                    ? 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                    : 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20'
                  }`}
              >
                <span className={isSelected ? 'text-white' : SUIT_COLOR[suit]}>
                  {rankStr}
                </span>
                <span className={`text-[10px] ${isSelected ? 'text-white' : SUIT_COLOR[suit]}`}>
                  {SUIT_SYMBOL[suit]}
                </span>
              </button>
            )
          }),
        )}
      </div>
      <div className="mt-1.5 flex gap-1 flex-wrap min-h-[28px]">
        {selected.map(c => (
          <span
            key={cardKey(c)}
            onClick={() => toggle(c)}
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-sm font-bold cursor-pointer bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 ${SUIT_COLOR[c.suit]}`}
          >
            {RANK_LABEL[c.rank]}{SUIT_SYMBOL[c.suit]}
          </span>
        ))}
        {selected.length === 0 && (
          <span className="text-xs text-gray-400 italic">None selected</span>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

const CATEGORY_NAMES: Record<number, string> = {
  8: 'Straight Flush', 7: 'Four of a Kind', 6: 'Full House',
  5: 'Flush', 4: 'Straight', 3: 'Three of a Kind',
  2: 'Two Pair', 1: 'One Pair', 0: 'High Card',
}

export default function OddsCalculatorPage() {
  const [game, setGame] = useState<'holdem' | 'omaha'>('holdem')
  const [playerCount, setPlayerCount] = useState(2)
  const [playerHands, setPlayerHands] = useState<Card[][]>([[], [], [], [], [], []])
  const [board, setBoard] = useState<Card[]>([])
  const [results, setResults] = useState<SimResult[] | null>(null)
  const [running, setRunning] = useState(false)

  const holeCardCount = game === 'holdem' ? 2 : 4

  const allUsed = useCallback((): Set<string> => {
    const s = new Set<string>()
    playerHands.slice(0, playerCount).forEach(h => h.forEach(c => s.add(cardKey(c))))
    board.forEach(c => s.add(cardKey(c)))
    return s
  }, [playerHands, board, playerCount])

  function setPlayerHand(idx: number, cards: Card[]) {
    const next = [...playerHands]
    next[idx] = cards
    setPlayerHands(next)
    setResults(null)
  }

  function setBoard2(cards: Card[]) {
    setBoard(cards)
    setResults(null)
  }

  function changeGame(g: 'holdem' | 'omaha') {
    setGame(g)
    setPlayerHands([[], [], [], [], [], []])
    setBoard([])
    setResults(null)
  }

  function canRun() {
    const activePlayers = playerHands.slice(0, playerCount)
    return activePlayers.every(h => h.length === holeCardCount)
  }

  function run() {
    if (!canRun()) return
    setRunning(true)
    setTimeout(() => {
      const players = playerHands.slice(0, playerCount)
      const res = simulate(game, players, board, 7500)
      setResults(res)
      setRunning(false)
    }, 10)
  }

  function pct(n: number, total: number) {
    return total === 0 ? '0.0' : ((n / total) * 100).toFixed(1)
  }

  const usedKeys = allUsed()

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center text-white text-xl">🎲</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Poker Odds Calculator</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Hold'em &amp; Omaha</p>
        </div>
      </div>

      {/* Config row */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mb-5">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Game</div>
            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              {(['holdem', 'omaha'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => changeGame(g)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    game === g
                      ? 'bg-brand-600 text-white'
                      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {g === 'holdem' ? "Hold'em" : 'Omaha'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Players</div>
            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              {[2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  onClick={() => { setPlayerCount(n); setResults(null) }}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    playerCount === n
                      ? 'bg-brand-600 text-white'
                      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Player hands */}
      <div className="space-y-4 mb-5">
        {Array.from({ length: playerCount }, (_, i) => {
          const otherUsed = new Set(usedKeys)
          playerHands[i].forEach(c => otherUsed.delete(cardKey(c)))
          return (
            <div key={i} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <CardPicker
                selected={playerHands[i]}
                onChange={cards => setPlayerHand(i, cards)}
                blocked={otherUsed}
                maxCards={holeCardCount}
                label={`Player ${i + 1} — ${holeCardCount} hole cards`}
              />
            </div>
          )
        })}
      </div>

      {/* Board */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5 mb-5">
        <CardPicker
          selected={board}
          onChange={setBoard2}
          blocked={(() => {
            const b = new Set(usedKeys)
            board.forEach(c => b.delete(cardKey(c)))
            return b
          })()}
          maxCards={5}
          label="Board (0–5 cards)"
        />
      </div>

      {/* Run */}
      <button
        onClick={run}
        disabled={!canRun() || running}
        className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors mb-6"
      >
        {running ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
            </svg>
            Running simulation…
          </span>
        ) : !canRun()
          ? `Select ${holeCardCount} cards for each player to calculate`
          : '🎲 Calculate Odds'}
      </button>

      {/* Results */}
      <p className="mt-2 mb-6 text-center text-xs text-gray-400 dark:text-gray-600">
        Powered by Headsuper
      </p>

      {results && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">Results</h2>
          </div>
          {results.slice(0, playerCount).map((r, i) => {
            const winPct = parseFloat(pct(r.wins, r.total))
            const tiePct = parseFloat(pct(r.ties, r.total))
            const hand = playerHands[i]
            return (
              <div key={i} className="px-5 py-4 border-b border-gray-50 dark:border-gray-800 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">Player {i + 1}</span>
                    <span className="flex gap-1">
                      {hand.map(c => (
                        <span key={cardKey(c)} className={`text-sm font-bold ${SUIT_COLOR[c.suit]}`}>
                          {RANK_LABEL[c.rank]}{SUIT_SYMBOL[c.suit]}
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-brand-600">{winPct.toFixed(1)}%</span>
                    <span className="text-xs text-gray-400 ml-1">win</span>
                    {tiePct > 0.1 && (
                      <span className="text-xs text-gray-400 ml-2">{tiePct.toFixed(1)}% tie</span>
                    )}
                  </div>
                </div>
                {/* Bar */}
                <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-600 rounded-full transition-all duration-500"
                    style={{ width: `${winPct + tiePct / 2}%` }}
                  />
                </div>
              </div>
            )
          })}
          <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-400 text-center">
            Results are probabilistic estimates
          </div>
        </div>
      )}
    </div>
  )
}
