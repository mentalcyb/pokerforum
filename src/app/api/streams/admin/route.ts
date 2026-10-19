import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/adminAuth'
import { diagnoseStreams } from '@/lib/streams'

export const maxDuration = 30

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/** Admin: every channel, waiting ones first. */
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { data, error } = await createAdminClient()
    .from('streamers').select('id, platform, channel, approved, created_at, profiles(username)')
    .order('approved').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ channels: data ?? [] })
}

/** Admin: { id, action: 'approve' | 'remove' } */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id, action } = await req.json().catch(() => ({}))
  if (action === 'check') {
    const report = await diagnoseStreams()
    revalidatePath('/streams')
    revalidatePath('/api/streams/live')
    return NextResponse.json(report)
  }
  if (!Number.isInteger(id) || !['approve', 'remove'].includes(action)) {
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
  const admin = createAdminClient()
  const { error } = action === 'approve'
    ? await admin.from('streamers').update({ approved: true, checked_at: null }).eq('id', id)
    : await admin.from('streamers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/streams')
  return NextResponse.json({ ok: true })
}
