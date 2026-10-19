import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { updateNews } from '@/lib/news'
import { isAdminRequest } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
// fetching feeds + one AI call; allow up to a minute
export const maxDuration = 60

/**
 * Daily news update. Called by the Vercel cron (see vercel.json), which sends
 * "Authorization: Bearer <CRON_SECRET>", or manually by an admin from /news.
 */
async function handle(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  const secret = process.env.CRON_SECRET
  const fromCron = !!secret && auth === `Bearer ${secret}`
  if (!fromCron && !(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const result = await updateNews()
  if (result.added > 0) {
    revalidatePath('/news')
  }
  console.log('[news] run:', result)
  return NextResponse.json(result, { status: result.error ? 500 : 200 })
}

export const GET = handle
export const POST = handle
