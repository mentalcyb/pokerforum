// Cards are two-character strings: rank + suit, e.g. "As" (ace of spades), "Td" (ten of diamonds).
export type Card = string

export const RANKS = '23456789TJQKA'
export const SUITS = 'shdc'

export function newDeck(): Card[] {
  const deck: Card[] = []
  for (const r of RANKS) for (const s of SUITS) deck.push(r + s)
  return deck
}

/** 2..14 (ace high) */
export function rankValue(card: Card): number {
  return RANKS.indexOf(card[0]) + 2
}

export function suitOf(card: Card): string {
  return card[1]
}

/**
 * Fisher–Yates shuffle. `randInt(n)` must return a uniform integer in [0, n).
 * The server passes crypto.randomInt so deals can't be predicted.
 */
export function shuffle<T>(items: readonly T[], randInt: (n: number) => number): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
