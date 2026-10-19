import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { parseChannel, userFromRequest, type Platform } from '@/lib/streams'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const PLATFORMS: Platform[] = ['twitch', 'youtube']

/** The signed-in member's own channels (approved or waiting). */
export async function GET(req: NextRequest) {
  const me = await userFromRequest(req)
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data, error } = await createAdminClient()
    .from('streamers').select('id, platform, channel, approved').eq('user_id', me.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ channels: data ?? [] })
}

/** Add or change a channel. Any change goes back to "waiting for approval". */
export async function POST(req: NextRequest) {
  const me = await userFromRequest(req)
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const platform = body.platform as Platform
  if (!PLATFORMS.includes(platform)) return NextResponse.json({ error: 'platform' }, { status: 400 })
  const channel = parseChannel(platform, String(body.input ?? ''))
  if (!channel) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin.from('streamers').select('id, channel, approved')
    .eq('user_id', me.id).eq('platform', platform).maybeSingle()
  if (existing && existing.channel === channel) return NextResponse.json({ ok: true, approved: existing.approved })
  // admins don't need to approve themselves
  const row = { user_id: me.id, platform, channel, approved: me.isAdmin, is_live: false, checked_at: null, title: null, viewers: null, thumbnail: null, video_id: null, live_since: null }
  const { error } = existing
    ? await admin.from('streamers').update(row).eq('id', existing.id)
    : await admin.from('streamers').insert(row)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/streams')
  return NextResponse.json({ ok: true, approved: me.isAdmin })
}

/** Remove one of my channels: DELETE /api/streams/me?platform=twitch */
export async function DELETE(req: NextRequest) {
  const me = await userFromRequest(req)
  if (!me) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const platform = req.nextUrl.searchParams.get('platform') as Platform
  if (!PLATFORMS.includes(platform)) return NextResponse.json({ error: 'platform' }, { status: 400 })
  const { error } = await createAdminClient().from('streamers').delete().eq('user_id', me.id).eq('platform', platform)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/streams')
  return NextResponse.json({ ok: true })
}
