import { Card, rankValue, suitOf } from './cards'

/**
 * Hand categories, weakest to strongest. The index is stored in game results
 * and translated in the UI (translations: hgHandNames).
 */
export const HAND_CATEGORIES = [
  'highCard', 'pair', 'twoPair', 'trips', 'straight', 'flush', 'fullHouse', 'quads', 'straightFlush',
] as const

/** [category, ...tiebreakers] — compare lexicographically, higher wins. */
export type HandScore = number[]

export function compareScores(a: HandScore, b: HandScore): number {
  const n = Math.max(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/** Score exactly five cards. */
export function score5(cards: Card[]): HandScore {
  const ranks = cards.map(rankValue).sort((a, b) => b - a)
  const isFlush = cards.every(c => suitOf(c) === suitOf(cards[0]))

  const counts = new Map<number, number>()
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1)
  // Groups sorted by size, then rank: e.g. full house K K K 4 4 → [[13,3],[4,2]]
  const groups = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0] - a[0])

  let straightHigh = 0
  if (counts.size === 5) {
    if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0]
    else if (ranks[0] === 14 && ranks[1] === 5) straightHigh = 5 // wheel: A-2-3-4-5
  }

  if (isFlush && straightHigh) return [8, straightHigh]
  if (groups[0][1] === 4) return [7, groups[0][0], groups[1][0]]
  if (groups[0][1] === 3 && groups[1][1] === 2) return [6, groups[0][0], groups[1][0]]
  if (isFlush) return [5, ...ranks]
  if (straightHigh) return [4, straightHigh]
  if (groups[0][1] === 3) return [3, groups[0][0], ...groups.slice(1).map(g => g[0])]
  if (groups[0][1] === 2 && groups[1][1] === 2) return [2, groups[0][0], groups[1][0], groups[2][0]]
  if (groups[0][1] === 2) return [1, groups[0][0], ...groups.slice(1).map(g => g[0])]
  return [0, ...ranks]
}

/** Best five-card score out of 5–7 cards (hole cards + board). */
export function bestScore(cards: Card[]): HandScore {
  if (cards.length < 5) throw new Error('need at least 5 cards')
  let best: HandScore | null = null
  const n = cards.length
  // every 5-card combination (21 for 7 cards)
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      for (let c = b + 1; c < n; c++)
        for (let d = c + 1; d < n; d++)
          for (let e = d + 1; e < n; e++) {
            const s = score5([cards[a], cards[b], cards[c], cards[d], cards[e]])
            if (!best || compareScores(s, best) > 0) best = s
          }
  return best!
}
