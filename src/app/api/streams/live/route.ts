import { NextResponse } from 'next/server'
import { getStreamers } from '@/lib/streams'

// Who's live right now (navbar dot + homepage block). Shared cache for a minute.
export const revalidate = 60
export const maxDuration = 30

export async function GET() {
  try {
    const live = (await getStreamers()).filter(s => s.is_live).map(s => ({
      id: s.id, platform: s.platform, channel: s.channel, title: s.title, viewers: s.viewers,
      username: s.profiles?.username ?? s.channel, avatar: s.profiles?.avatar ?? null,
    }))
    return NextResponse.json({ live })
  } catch {
    // table not created yet
    return NextResponse.json({ live: [] })
  }
}
