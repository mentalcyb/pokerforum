import { NextRequest, NextResponse } from 'next/server'
import { getViewer, loadTable, viewFor } from '@/lib/poker/server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

/** Current table state for the viewer (anyone with the invite link can watch). */
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const [viewer, loaded] = await Promise.all([getViewer(req), loadTable(params.code)])
    if (!loaded) return NextResponse.json({ error: 'table_not_found' }, { status: 404 })
    return NextResponse.json(viewFor(loaded.row, loaded.secret, viewer?.id ?? null), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    console.error('[home-games] load failed:', e)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
