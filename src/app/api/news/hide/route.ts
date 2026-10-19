import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase-admin'
import { isAdminRequest } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

/** Admin hides a news item (e.g. a bad AI summary). */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await req.json().catch(() => ({}))
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  const { error } = await createAdminClient().from('news_items').update({ hidden: true }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/news')
  return NextResponse.json({ ok: true })
}
