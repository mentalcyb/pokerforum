import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import type { HandRecord } from '@/lib/poker/engine'
import { getViewer, handForViewer, loadTable } from '@/lib/poker/server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const LIMIT = 30

/** The most recent finished hands at a table, with hidden cards removed for this viewer. */
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const [viewer, loaded] = await Promise.all([getViewer(req), loadTable(params.code)])
    if (!loaded) return NextResponse.json({ error: 'table_not_found' }, { status: 404 })
    const { data, error } = await createAdminClient()
      .from('poker_hands')
      .select('id, data')
      .eq('table_id', loaded.row.id)
      .order('id', { ascending: false })
      .limit(LIMIT)
    if (error) {
      // table not created yet (supabase/home_games_history.sql not run)
      console.warn('[home-games] hand history unavailable:', error.message)
      return NextResponse.json({ hands: [], unavailable: true }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const hands = (data ?? []).map(r => ({ id: r.id as number, ...handForViewer(r.data as HandRecord, viewer?.id ?? null) }))
    return NextResponse.json({ hands }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[home-games] hands failed:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
