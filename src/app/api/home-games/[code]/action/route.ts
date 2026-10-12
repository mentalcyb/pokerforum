import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  act, addChat, GameError, kick, leave, rebuy, seatOf, setPaused, setSittingOut, showCards, sit, startGame, tick,
  TableConfig, validateConfig,
} from '@/lib/poker/engine'
import { getViewer, loadTable, mutateTable, viewFor } from '@/lib/poker/server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const PLAYER_ACTIONS = ['fold', 'check', 'call', 'raise'] as const
// Any seated player may deal the first hand; pausing stays with the host.
const HOST_ACTIONS = ['pause', 'resume', 'close', 'kick', 'settings'] as const

function err(code: string, status = 400) {
  return NextResponse.json({ error: code }, { status })
}

export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action ?? '')
    const viewer = await getViewer(req)

    // "tick" only advances timers that have already run out, so anyone watching may send it.
    if (action !== 'tick' && !viewer) return err('unauthorized', 401)

    if (action === 'settings') {
      // Blinds and timer change between hands only, so a running hand keeps its rules.
      const loaded = await loadTable(params.code)
      if (!loaded) return err('table_not_found', 404)
      const { row } = loaded
      if (row.host_id !== viewer!.id) return err('host_only', 403)
      if (row.closed) return err('table_closed')
      if (row.state.phase === 'playing') return err('hand_in_progress')
      // A running tournament keeps its blind structure; only the turn timer can change.
      const lockBlinds = row.config.mode === 'tournament' && row.state.started
      const cfg: TableConfig = {
        ...row.config,
        smallBlind: lockBlinds ? row.config.smallBlind : Number(body.smallBlind ?? row.config.smallBlind),
        bigBlind: lockBlinds ? row.config.bigBlind : Number(body.bigBlind ?? row.config.bigBlind),
        turnSeconds: Number(body.turnSeconds ?? row.config.turnSeconds),
      }
      const invalid = validateConfig(cfg)
      if (invalid) return err(invalid)
      const { data, error } = await createAdminClient()
        .from('poker_tables')
        .update({ config: cfg, version: row.version + 1, updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('version', row.version)
        .select('id')
      if (error) throw error
      if (!data?.length) return err('busy')
      return NextResponse.json(viewFor({ ...row, config: cfg, version: row.version + 1 }, loaded.secret, viewer!.id))
    }

    if (action === 'close') {
      const loaded = await loadTable(params.code)
      if (!loaded) return err('table_not_found', 404)
      if (loaded.row.host_id !== viewer!.id) return err('host_only', 403)
      if (loaded.row.state.phase === 'playing') return err('hand_in_progress')
      const { error } = await createAdminClient().from('poker_tables').update({ closed: true }).eq('id', loaded.row.id)
      if (error) throw error
      return NextResponse.json(viewFor({ ...loaded.row, closed: true }, loaded.secret, viewer!.id))
    }

    const saved = await mutateTable(params.code, ({ row, state, secret, ctx }) => {
      const mySeat = viewer ? seatOf(state, viewer.id) : -1
      const isHost = !!viewer && viewer.id === row.host_id
      const needSeat = () => { if (mySeat < 0) throw new GameError('not_seated') }

      if ((HOST_ACTIONS as readonly string[]).includes(action) && !isHost) throw new GameError('host_only')

      switch (action) {
        case 'tick':
          return tick(state, secret, ctx)
        case 'sit':
          return { state: sit(state, ctx.cfg, Number(body.seat), { userId: viewer!.id, name: viewer!.name, avatar: viewer!.avatar }) }
        case 'leave':
          needSeat()
          return leave(state, secret, ctx, mySeat)
        case 'rebuy':
          needSeat()
          return { state: rebuy(state, ctx.cfg, mySeat) }
        case 'show':
          needSeat()
          return { state: showCards(state, secret, mySeat) }
        case 'sitOut':
          needSeat()
          return { state: setSittingOut(state, mySeat, true) }
        case 'sitIn':
          needSeat()
          return { state: setSittingOut(state, mySeat, false) }
        case 'start':
          if (mySeat < 0 && !isHost) throw new GameError('not_seated')
          return startGame(state, secret, ctx)
        case 'kick': {
          const target = Number(body.seat)
          if (target === mySeat) throw new GameError('cannot_kick_self')
          return kick(state, secret, ctx, target)
        }
        case 'chat':
          if (mySeat < 0 && !isHost) throw new GameError('not_seated')
          return { state: addChat(state, { userId: viewer!.id, name: viewer!.name }, String(body.text ?? ''), ctx.now) }
        case 'pause':
          return { state: setPaused(state, true, ctx.now) }
        case 'resume':
          return { state: setPaused(state, false, ctx.now) }
        default:
          if ((PLAYER_ACTIONS as readonly string[]).includes(action)) {
            needSeat()
            const a = action === 'raise'
              ? { type: 'raise' as const, amount: Number(body.amount) }
              : { type: action as 'fold' | 'check' | 'call' }
            return act(state, secret, ctx, mySeat, a)
          }
          throw new GameError('invalid_action')
      }
    })

    return NextResponse.json(viewFor(saved.row, saved.secret, viewer?.id ?? null))
  } catch (e) {
    if (e instanceof GameError) return err(e.code, e.code === 'table_not_found' ? 404 : 400)
    console.error('[home-games] action failed:', e)
    return err('server_error', 500)
  }
}
