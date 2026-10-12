import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import {
  act, GameError, leave, rebuy, seatOf, setPaused, setSittingOut, sit, startGame, tick,
} from '@/lib/poker/engine'
import { getViewer, loadTable, mutateTable, viewFor } from '@/lib/poker/server'

export const dynamic = 'force-dynamic'

const PLAYER_ACTIONS = ['fold', 'check', 'call', 'raise'] as const
const HOST_ACTIONS = ['start', 'pause', 'resume', 'close'] as const

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
        case 'sitOut':
          needSeat()
          return { state: setSittingOut(state, mySeat, true) }
        case 'sitIn':
          needSeat()
          return { state: setSittingOut(state, mySeat, false) }
        case 'start':
          return startGame(state, secret, ctx)
        case 'pause':
          return { state: setPaused(state, true) }
        case 'resume':
          return { state: setPaused(state, false) }
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
