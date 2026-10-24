'use client'
import { useState } from 'react'
import { roomIcon, type Room } from '@/data/rooms'

/** Room's site icon; falls back to a coloured initials badge if there's none or it fails to load. */
export default function RoomIcon({ room, size = 36 }: { room: Room; size?: number }) {
  const [failed, setFailed] = useState(false)
  const src = roomIcon(room)
  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={room.name} width={size} height={size} onError={() => setFailed(true)}
        className="rounded-lg bg-white p-1 shrink-0 object-contain" style={{ width: size, height: size }} />
    )
  }
  return (
    <span className="rounded-lg flex items-center justify-center text-white font-bold text-xs shrink-0"
      style={{ background: room.color, width: size, height: size }}>
      {room.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()}
    </span>
  )
}
