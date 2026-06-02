'use client'
import React from 'react'

export type AvatarId = 'spade' | 'heart' | 'diamond' | 'club' | 'chip' | 'ace' | 'ninja'

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
