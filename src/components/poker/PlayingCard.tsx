const SUIT_SYMBOL: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }

// Classic: black ♠♣, red ♥♦. Four-color: ♠ black, ♥ red, ♦ blue, ♣ green — easier to tell suits apart.
const SUIT_COLOR: Record<string, string> = { s: 'text-gray-900', c: 'text-gray-900', h: 'text-red-600', d: 'text-red-600' }
const SUIT_COLOR_4: Record<string, string> = { s: 'text-gray-900', c: 'text-green-700', h: 'text-red-600', d: 'text-blue-600' }

const SIZES = {
  sm: 'w-8 h-11 text-sm rounded',
  md: 'w-11 h-[3.75rem] text-base rounded-md sm:w-12 sm:h-[4.25rem] sm:text-lg',
  lg: 'w-12 h-[4.5rem] text-lg rounded-lg sm:w-16 sm:h-[5.5rem] sm:text-2xl',
}

type Props = {
  /** e.g. "As"; omit for a face-down card */
  card?: string
  size?: keyof typeof SIZES
  fourColor?: boolean
  dim?: boolean
  highlight?: boolean
}

export default function PlayingCard({ card, size = 'md', fourColor, dim, highlight }: Props) {
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
  const color = (fourColor ? SUIT_COLOR_4 : SUIT_COLOR)[suit]
  return (
    <div
      className={`${base} bg-white border-gray-300 flex flex-col items-center justify-center leading-none font-bold ${color} ${dim ? 'opacity-40' : ''} ${highlight ? 'ring-2 ring-amber-400 -translate-y-1' : ''}`}
      aria-label={`${rank}${SUIT_SYMBOL[suit]}`}
    >
      <span>{rank}</span>
      <span className="mt-0.5">{SUIT_SYMBOL[suit]}</span>
    </div>
  )
}
