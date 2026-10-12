import type { Lang, T } from './translations'

/** Category rows may carry optional English columns (name_en / description_en). */
type Localizable = { name?: string | null; name_en?: string | null; description?: string | null; description_en?: string | null }

/** Category name in the current language, falling back to the Georgian original. */
export function catName(cat: Localizable | null | undefined, lang: Lang): string {
  if (!cat) return ''
  return (lang === 'en' && cat.name_en) ? cat.name_en : (cat.name ?? '')
}

/** Category description in the current language, falling back to the Georgian original. */
export function catDesc(cat: Localizable | null | undefined, lang: Lang): string {
  if (!cat) return ''
  return (lang === 'en' && cat.description_en) ? cat.description_en : (cat.description ?? '')
}

/** "12 October 2026" / "12 ოქტომბერი 2026" */
export function formatDate(date: Date, t: T): string {
  return `${date.getDate()} ${t.months[date.getMonth()]} ${date.getFullYear()}`
}

/** Street label for a board of n cards (0, 3, 4 or 5). */
export function streetName(boardLen: number, t: T): string {
  if (boardLen === 0) return t.streetPreflop
  if (boardLen === 3) return t.streetFlop
  if (boardLen === 4) return t.streetTurn
  if (boardLen === 5) return t.streetRiver
  return t.ocBoard(boardLen)
}
