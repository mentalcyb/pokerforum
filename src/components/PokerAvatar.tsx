'use client'
import React from 'react'

export type AvatarId = 'spade' | 'heart' | 'diamond' | 'club' | 'chip' | 'ace' | 'ninja'
  | 'fish' | 'shark' | 'whale' | 'donkey' | 'octopus' | 'frog' | 'cat' | 'owl' | 'crab'

export const AVATARS: { id: AvatarId; label: string; bg: string; svg: React.ReactNode }[] = [
  {
    id: 'spade',
    label: 'Spade',
    bg: 'bg-gray-900 dark:bg-gray-700',
    svg: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1.5">
        <path d="M20 4C20 4 6 13 6 22C6 27.523 10.477 32 16 32C17.2 32 18.35 31.77 19.4 31.36C18.8 33.36 17.5 35 16 36H24C22.5 35 21.2 33.36 20.6 31.36C21.65 31.77 22.8 32 24 32C29.523 32 34 27.523 34 22C34 13 20 4 20 4Z" fill="white"/>
      </svg>
    ),
  },
  {
    id: 'heart',
    label: 'Heart',
    bg: 'bg-red-600',
    svg: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1.5">
        <path d="M20 34L6.4 21C4.87 19.47 4 17.38 4 15.2C4 10.69 7.69 7 12.2 7C14.38 7 16.47 7.87 18 9.4L20 11.4L22 9.4C23.53 7.87 25.62 7 27.8 7C32.31 7 36 10.69 36 15.2C36 17.38 35.13 19.47 33.6 21L20 34Z" fill="white"/>
      </svg>
    ),
  },
  {
    id: 'diamond',
    label: 'Diamond',
    bg: 'bg-blue-600',
    svg: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1.5">
        <path d="M20 4L36 20L20 36L4 20L20 4Z" fill="white"/>
      </svg>
    ),
  },
  {
    id: 'club',
    label: 'Club',
    bg: 'bg-green-700',
    svg: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1.5">
        <circle cx="14" cy="17" r="6" fill="white"/>
        <circle cx="26" cy="17" r="6" fill="white"/>
        <circle cx="20" cy="12" r="6" fill="white"/>
        <rect x="17" y="26" width="6" height="8" rx="1" fill="white"/>
        <rect x="13" y="32" width="14" height="3" rx="1.5" fill="white"/>
      </svg>
    ),
  },
  {
    id: 'chip',
    label: 'Chip',
    bg: 'bg-purple-700',
    svg: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full p-1">
        <circle cx="20" cy="20" r="15" stroke="white" strokeWidth="3" fill="none"/>
        <circle cx="20" cy="20" r="10" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.5"/>
        <circle cx="20" cy="20" r="5" fill="white" fillOpacity="0.3"/>
        {/* Notches */}
        {[0,60,120,180,240,300].map((deg, i) => {
          const r = 15, rad = (deg * Math.PI) / 180
          const x1 = 20 + (r - 2) * Math.cos(rad), y1 = 20 + (r - 2) * Math.sin(rad)
          const x2 = 20 + (r + 0) * Math.cos(rad), y2 = 20 + (r + 0) * Math.sin(rad)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="3" strokeLinecap="round"/>
        })}
      </svg>
    ),
  },
  {
    id: 'ace',
    label: 'Ace',
    bg: 'bg-amber-600',
    svg: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect x="6" y="5" width="28" height="30" rx="4" fill="white" fillOpacity="0.15" stroke="white" strokeWidth="1.5"/>
        <text x="20" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="serif">A</text>
        <text x="20" y="28" textAnchor="middle" fill="white" fontSize="10" fontFamily="serif">♠</text>
      </svg>
    ),
  },
  {
    id: 'ninja',
    label: 'Ninja',
    bg: 'bg-slate-800',
    svg: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Hood — dark wrap covering top and sides of head */}
        <path d="M20 5C13 5 8 10 8 17V20C8 27.732 13.373 34 20 34C26.627 34 32 27.732 32 20V17C32 10 27 5 20 5Z" fill="white" fillOpacity="0.12"/>
        {/* Face area — lighter oval */}
        <ellipse cx="20" cy="20" rx="8" ry="9" fill="white" fillOpacity="0.18"/>
        {/* Mask band — covers nose and mouth */}
        <rect x="12" y="21" width="16" height="6" rx="2" fill="white" fillOpacity="0.85"/>
        {/* Mask diagonal wrinkle lines */}
        <line x1="15" y1="22.5" x2="15" y2="25.5" stroke="white" strokeOpacity="0.3" strokeWidth="1"/>
        <line x1="18" y1="22" x2="18" y2="26" stroke="white" strokeOpacity="0.3" strokeWidth="1"/>
        <line x1="21" y1="22" x2="21" y2="26" stroke="white" strokeOpacity="0.3" strokeWidth="1"/>
        <line x1="24" y1="22.5" x2="24" y2="25.5" stroke="white" strokeOpacity="0.3" strokeWidth="1"/>
        {/* Eyes — narrow, intense */}
        <ellipse cx="16.5" cy="18" rx="2.5" ry="1.6" fill="white"/>
        <ellipse cx="23.5" cy="18" rx="2.5" ry="1.6" fill="white"/>
        {/* Pupils */}
        <ellipse cx="16.5" cy="18" rx="1.2" ry="1.2" fill="white" fillOpacity="0.15"/>
        <ellipse cx="23.5" cy="18" rx="1.2" ry="1.2" fill="white" fillOpacity="0.15"/>
        {/* Card peeking from collar */}
        <rect x="17" y="31" width="6" height="5" rx="1" fill="white" fillOpacity="0.5" transform="rotate(-8 17 31)"/>
        <text x="19.5" y="35.5" textAnchor="middle" fill="white" fillOpacity="0.9" fontSize="4" fontWeight="bold" fontFamily="serif">♠</text>
      </svg>
    ),
  },
  // ── Funny animals (poker slang: fish = weak player, shark = strong one, whale = big spender, donkey = "donk") ──
  {
    id: 'fish',
    label: 'Fish',
    bg: 'bg-sky-400',
    svg: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M29 20L37 13V27L29 20Z" fill="#f97316"/>
        <ellipse cx="18" cy="20" rx="13" ry="9" fill="#fb923c"/>
        <path d="M14 11.5C16 8 21 8 23 11.5" stroke="#f97316" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="11" cy="17.5" r="3.6" fill="white"/>
        <circle cx="11.6" cy="18" r="1.8" fill="#1f2937"/>
        <ellipse cx="6.3" cy="22.5" rx="1.6" ry="2" fill="#7c2d12"/>
        <path d="M19 15C21 18 21 22 19 25" stroke="#ea580c" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="4" cy="12" r="1.3" stroke="white" strokeWidth="0.8"/>
        <circle cx="6" cy="8" r="0.9" stroke="white" strokeWidth="0.7"/>
      </svg>
    ),
  },
  {
    id: 'shark',
    label: 'Shark',
    bg: 'bg-blue-900',
    svg: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M20 4L25 14H15L20 4Z" fill="#94a3b8"/>
        <path d="M5 22C5 14 12 11 20 11C28 11 35 14 35 22C35 29 28 33 20 33C12 33 5 29 5 22Z" fill="#94a3b8"/>
        <path d="M8 25C10 30 15 32 20 32C25 32 30 30 32 25Z" fill="white"/>
        <path d="M9 25L11 28L13 25L15 28.5L17 25L19 28.8L21 25L23 28.8L25 25L27 28.5L29 25L31 27" stroke="#475569" strokeWidth="0.9" strokeLinejoin="round" fill="white"/>
        <rect x="9" y="16.5" width="9" height="4.5" rx="2" fill="#0f172a"/>
        <rect x="22" y="16.5" width="9" height="4.5" rx="2" fill="#0f172a"/>
        <rect x="17.5" y="18" width="5" height="1.2" fill="#0f172a"/>
        <path d="M10.5 17.5L13 17.5" stroke="white" strokeOpacity="0.6" strokeWidth="0.8" strokeLinecap="round"/>
        <path d="M23.5 17.5L26 17.5" stroke="white" strokeOpacity="0.6" strokeWidth="0.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'whale',
    label: 'Whale',
    bg: 'bg-indigo-500',
    svg: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M20 9C19 6 17 5 15 5M20 9C21 6 23 5 25 5M20 9V12" stroke="#bae6fd" strokeWidth="1.8" strokeLinecap="round"/>
        <path d="M4 24C4 17 11 13 19 13C27 13 33 17 33 23C33 25 34.5 26 36.5 25C36 29 33 30 31 29.5C28 32 24 33 19 33C10 33 4 30 4 24Z" fill="#3b82f6"/>
        <path d="M6 27C9 31 14 32 19 32C24 32 28 31 30 29C24 30 13 30 6 27Z" fill="#bfdbfe"/>
        <circle cx="12" cy="21" r="1.8" fill="#0f172a"/>
        <circle cx="12.6" cy="20.4" r="0.6" fill="white"/>
        <path d="M8 25.5C10 26.5 13 26.5 15 25.5" stroke="#0f172a" strokeWidth="1.1" strokeLinecap="round"/>
        <ellipse cx="9" cy="23.5" rx="1.7" ry="1" fill="#f9a8d4" fillOpacity="0.8"/>
        <text x="25" y="23" textAnchor="middle" fill="#fde047" fontSize="7" fontWeight="bold">$</text>
      </svg>
    ),
  },
  {
    id: 'donkey',
    label: 'Donkey',
    bg: 'bg-stone-400',
    svg: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M11 4L15 15L9 14Z" fill="#78716c"/>
        <path d="M29 4L25 15L31 14Z" fill="#78716c"/>
        <path d="M12 7L14 13" stroke="#fda4af" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M28 7L26 13" stroke="#fda4af" strokeWidth="1.5" strokeLinecap="round"/>
        <ellipse cx="20" cy="20" rx="10" ry="9" fill="#a8a29e"/>
        <ellipse cx="20" cy="29" rx="9" ry="7" fill="#e7e5e4"/>
        <path d="M17 11L20 15L23 11" fill="#44403c"/>
        <circle cx="15.5" cy="20" r="2.3" fill="white"/>
        <circle cx="24.5" cy="20" r="2.3" fill="white"/>
        <circle cx="16.3" cy="20.5" r="1.1" fill="#1c1917"/>
        <circle cx="23.7" cy="19.5" r="1.1" fill="#1c1917"/>
        <ellipse cx="16.5" cy="28" rx="1.3" ry="1" fill="#57534e"/>
        <ellipse cx="23.5" cy="28" rx="1.3" ry="1" fill="#57534e"/>
        <path d="M16 32.5C18 34 22 34 24 32.5" stroke="#57534e" strokeWidth="1.2" strokeLinecap="round"/>
        <rect x="18.2" y="32.8" width="1.6" height="2" fill="white" stroke="#57534e" strokeWidth="0.4"/>
        <rect x="20.2" y="32.8" width="1.6" height="2" fill="white" stroke="#57534e" strokeWidth="0.4"/>
      </svg>
    ),
  },
  {
    id: 'octopus',
    label: 'Octopus',
    bg: 'bg-fuchsia-600',
    svg: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M9 24C6 28 5 33 8 34M14 26C12 30 12 34 14 36M20 27V36M26 26C28 30 28 34 26 36M31 24C34 28 35 33 32 34" stroke="#f9a8d4" strokeWidth="3" strokeLinecap="round"/>
        <path d="M8 19C8 11 13 5 20 5C27 5 32 11 32 19C32 24 27 27 20 27C13 27 8 24 8 19Z" fill="#f472b6"/>
        <circle cx="15" cy="17" r="3.4" fill="white"/>
        <circle cx="25" cy="17" r="3.4" fill="white"/>
        <circle cx="15.8" cy="16.5" r="1.7" fill="#1f2937"/>
        <circle cx="24.2" cy="16.5" r="1.7" fill="#1f2937"/>
        <path d="M17 22.5C18.5 24 21.5 24 23 22.5" stroke="#831843" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="13" cy="10" r="1.2" fill="#fbcfe8"/>
        <circle cx="17" cy="8.5" r="0.9" fill="#fbcfe8"/>
        <rect x="27.5" y="25" width="6" height="8" rx="1" fill="white" transform="rotate(20 27.5 25)"/>
        <text x="30" y="31.5" textAnchor="middle" fill="#dc2626" fontSize="5" fontWeight="bold" transform="rotate(20 30 30)">A</text>
      </svg>
    ),
  },
  {
    id: 'frog',
    label: 'Frog',
    bg: 'bg-lime-500',
    svg: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <ellipse cx="20" cy="25" rx="14" ry="10" fill="#16a34a"/>
        <circle cx="12.5" cy="14" r="6" fill="#16a34a"/>
        <circle cx="27.5" cy="14" r="6" fill="#16a34a"/>
        <circle cx="12.5" cy="14" r="4" fill="white"/>
        <circle cx="27.5" cy="14" r="4" fill="white"/>
        <circle cx="13" cy="15" r="2" fill="#111827"/>
        <circle cx="27" cy="15" r="2" fill="#111827"/>
        <path d="M10 11.5C11.5 10.5 13.5 10.5 15 11.5" stroke="#14532d" strokeWidth="1.2" strokeLinecap="round"/>
        <path d="M11 26C15 30.5 25 30.5 29 26" stroke="#14532d" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M24 28.5C25 33 28 33 28 29" fill="#f43f5e"/>
        <circle cx="10" cy="23" r="1.6" fill="#86efac"/>
        <circle cx="30" cy="23" r="1.6" fill="#86efac"/>
      </svg>
    ),
  },
  {
    id: 'cat',
    label: 'Cool Cat',
    bg: 'bg-orange-300',
    svg: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M8 6L15 13L8 16Z" fill="#9a3412"/>
        <path d="M32 6L25 13L32 16Z" fill="#9a3412"/>
        <path d="M10 9L13 13L10 14Z" fill="#fda4af"/>
        <path d="M30 9L27 13L30 14Z" fill="#fda4af"/>
        <ellipse cx="20" cy="22" rx="13" ry="12" fill="#ea580c"/>
        <path d="M17 11L20 14L23 11" stroke="#9a3412" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M9 18H31L30 22C29 24.5 26.5 25 25 24L22 21.5H18L15 24C13.5 25 11 24.5 10 22Z" fill="#111827"/>
        <path d="M11.5 19.5L14.5 19.5" stroke="white" strokeOpacity="0.7" strokeWidth="0.9" strokeLinecap="round"/>
        <path d="M24 19.5L27 19.5" stroke="white" strokeOpacity="0.7" strokeWidth="0.9" strokeLinecap="round"/>
        <path d="M18.5 26.5L20 28L21.5 26.5Z" fill="#fda4af"/>
        <path d="M20 28C19 30.5 16.5 30.5 16 29M20 28C21 30.5 23.5 30.5 24 29" stroke="#7c2d12" strokeWidth="1" strokeLinecap="round"/>
        <path d="M5 26L12 27M5 30L12 28.5M35 26L28 27M35 30L28 28.5" stroke="#fff7ed" strokeWidth="0.8" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'owl',
    label: 'Owl',
    bg: 'bg-violet-700',
    svg: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M8 6L14 12H8Z" fill="#a16207"/>
        <path d="M32 6L26 12H32Z" fill="#a16207"/>
        <path d="M7 12C7 9 10 8 20 8C30 8 33 9 33 12V26C33 32 27 36 20 36C13 36 7 32 7 26Z" fill="#ca8a04"/>
        <path d="M13 28L15 30L17 28L19 30L21 28L23 30L25 28L27 30" stroke="#a16207" strokeWidth="1" strokeLinecap="round"/>
        <circle cx="14" cy="18" r="5.5" fill="white"/>
        <circle cx="26" cy="18" r="5.5" fill="white"/>
        <circle cx="14" cy="18" r="5.5" stroke="#1f2937" strokeWidth="1.2"/>
        <circle cx="26" cy="18" r="5.5" stroke="#1f2937" strokeWidth="1.2"/>
        <path d="M19.5 18H20.5" stroke="#1f2937" strokeWidth="1.2"/>
        <circle cx="14.5" cy="18.5" r="2.2" fill="#1f2937"/>
        <circle cx="25.5" cy="18.5" r="2.2" fill="#1f2937"/>
        <path d="M18.5 22L20 25L21.5 22Z" fill="#f97316"/>
        <path d="M9 12.5C11 11 15 11 17 12.5" stroke="#713f12" strokeWidth="1.3" strokeLinecap="round"/>
        <path d="M23 13C25 11.5 29 11.5 31 13.5" stroke="#713f12" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'crab',
    label: 'Crab',
    bg: 'bg-cyan-600',
    svg: (
      <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <path d="M7 15C3 13 3 8 6 6C6 9 8 10 10 9C11 12 9 15 7 15Z" fill="#ef4444"/>
        <path d="M33 15C37 13 37 8 34 6C34 9 32 10 30 9C29 12 31 15 33 15Z" fill="#ef4444"/>
        <path d="M8 15L12 21M32 15L28 21" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round"/>
        <path d="M9 28L5 31M10 31L7 35M31 28L35 31M30 31L33 35" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/>
        <ellipse cx="20" cy="26" rx="12" ry="8" fill="#ef4444"/>
        <path d="M16 18V13M24 18V13" stroke="#ef4444" strokeWidth="1.8"/>
        <circle cx="16" cy="12" r="3" fill="white"/>
        <circle cx="24" cy="12" r="3" fill="white"/>
        <circle cx="15.3" cy="12.6" r="1.4" fill="#111827"/>
        <circle cx="24.7" cy="11.4" r="1.4" fill="#111827"/>
        <path d="M15 27C17.5 29.5 22.5 29.5 25 27" stroke="#7f1d1d" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="12.5" cy="25" r="1.4" fill="#fca5a5"/>
        <circle cx="27.5" cy="25" r="1.4" fill="#fca5a5"/>
      </svg>
    ),
  },
]

interface Props {
  avatarId?: string | null
  size?: number   // pixel size, default 36
  className?: string
}

export default function PokerAvatar({ avatarId, size = 36, className = '' }: Props) {
  const av = AVATARS.find(a => a.id === avatarId) ?? AVATARS[0]
  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 ${av.bg} ${className}`}
      style={{ width: size, height: size }}
    >
      {av.svg}
    </div>
  )
}
