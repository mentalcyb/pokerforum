import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { GameError, initialState, sit, TableConfig, validateConfig } from '@/lib/poker/engine'
import { getViewer, newCode } from '@/lib/poker/server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const MAX_OPEN_TABLES_PER_HOST = 5

function err(code: string, status = 400) {
  return NextResponse.json({ error: code }, { status })
}

/** Tables the signed-in user hosts or plays at. */
export async function GET(req: NextRequest) {
  try {
    const viewer = await getViewer(req)
    if (!viewer) return err('unauthorized', 401)
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('poker_tables')
      .select('code, name, host_id, config, state, closed, updated_at')
      .or(`host_id.eq.${viewer.id},player_ids.cs.{${viewer.id}}`)
      .eq('closed', false)
      .order('updated_at', { ascending: false })
      .limit(20)
    if (error) throw error
    const tables = (data ?? []).map(t => ({
      code: t.code,
      name: t.name,
      isHost: t.host_id === viewer.id,
      config: t.config,
      players: (t.state?.seats ?? []).filter(Boolean).length,
      phase: t.state?.phase,
      updatedAt: t.updated_at,
    }))
    return NextResponse.json({ tables })
  } catch (e) {
    console.error('[home-games] list failed:', e)
    return err('server_error', 500)
  }
}

/** Create a table; the host is seated at seat 0. */
export async function POST(req: NextRequest) {
  try {
    const viewer = await getViewer(req)
    if (!viewer) return err('unauthorized', 401)
    const body = await req.json().catch(() => ({}))

    const name = String(body.name ?? '').trim().slice(0, 40) || `${viewer.name}'s table`
    const cfg: TableConfig = {
      smallBlind: Number(body.smallBlind),
      bigBlind: Number(body.bigBlind),
      startingStack: Number(body.startingStack),
      maxSeats: Number(body.maxSeats),
      turnSeconds: Number(body.turnSeconds),
    }
    const invalid = validateConfig(cfg)
    if (invalid) return err(invalid)

    const admin = createAdminClient()
    const { count, error: countErr } = await admin
      .from('poker_tables')
      .select('id', { count: 'exact', head: true })
      .eq('host_id', viewer.id)
      .eq('closed', false)
    if (countErr) throw countErr
    if ((count ?? 0) >= MAX_OPEN_TABLES_PER_HOST) return err('too_many_tables')

    const state = sit(initialState(cfg), cfg, 0, { userId: viewer.id, name: viewer.name, avatar: viewer.avatar })

    // retry on the (very unlikely) invite-code collision
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = newCode()
      const { data: row, error } = await admin
        .from('poker_tables')
        .insert({ code, name, host_id: viewer.id, config: cfg, state, player_ids: [viewer.id] })
        .select('id, code')
        .single()
      if (error?.code === '23505') continue
      if (error) throw error
      const { error: secErr } = await admin.from('poker_table_secrets').insert({ table_id: row.id })
      if (secErr) throw secErr
      return NextResponse.json({ code: row.code })
    }
    return err('server_error', 500)
  } catch (e) {
    if (e instanceof GameError) return err(e.code)
    console.error('[home-games] create failed:', e)
    return err('server_error', 500)
  }
}
