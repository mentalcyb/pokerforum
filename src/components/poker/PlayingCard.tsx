const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }
const SUIT_COLOR: Record<string, string> = {
  s: 'text-gray-900',
  c: 'text-gray-900',
  h: 'text-red-600',
  d: 'text-red-600',
}

const SIZES = {
  sm: 'w-7 h-10 text-xs rounded',
  md: 'w-10 h-14 text-sm rounded-md',
  lg: 'w-12 h-[4.25rem] sm:w-14 sm:h-20 text-base sm:text-lg rounded-lg',
}

type Props = {
  /** e.g. "As"; omit for a face-down card */
  card?: string
  size?: keyof typeof SIZES
  dim?: boolean
  highlight?: boolean
}

export default function PlayingCard({ card, size = 'md', dim, highlight }: Props) {
  const base = `${SIZES[size]} flex-shrink-0 select-none shadow-md border transition-all`
  if (!card) {
    return (
      <div
        aria-hidden
        className={`${base} border-brand-800 bg-brand-700 bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.12)_0_4px,transparent_4px_8px)] ${dim ? 'opacity-40' : ''}`}
      />
    )
  }
  const rank = card[0] === 'T' ? '10' : card[0]
  const suit = card[1]
  return (
    <div
      className={`${base} bg-white border-gray-300 flex flex-col items-center justify-center leading-none font-bold ${SUIT_COLOR[suit]} ${dim ? 'opacity-40' : ''} ${highlight ? 'ring-2 ring-amber-400 -translate-y-1' : ''}`}
      aria-label={`${rank}${SUIT_SYMBOL[suit]}`}
    >
      <span>{rank}</span>
      <span className="mt-0.5">{SUIT_SYMBOL[suit]}</span>
    </div>
  )
}
