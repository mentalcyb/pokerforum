import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { updateNews, backfillArticles } from '@/lib/news'
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
  const secret = process.env.CRON_SECRET?.trim()
  const fromCron = !!secret && auth === `Bearer ${secret}`
  if (!fromCron && !(await isAdminRequest(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const started = Date.now()
  const result = await updateNews()
  if (result.added > 0) {
    revalidatePath('/news')
  }
  // use the remaining time to write full articles for older stories that don't have one yet
  let articles = 0
  const left = 50000 - (Date.now() - started)
  if (left > 10000) {
    try { articles = await backfillArticles(12, left - 5000) } catch (e) { console.warn('[news] backfill failed:', e) }
  }
  console.log('[news] run:', result, 'articles:', articles)
  return NextResponse.json({ ...result, articles }, { status: result.error ? 500 : 200 })
}

export const GET = handle
export const POST = handle
