// Server-side helpers for home-game tables. Only import from API routes:
// this module uses the service-role key and reads hidden cards.
import { randomInt } from 'crypto'
import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { cardsFor, Ctx, GameError, GameState, HandRecord, Secret, seatOf, TableConfig } from './engine'

export type TableRow = {
  id: string
  code: string
  name: string
  host_id: string
  config: TableConfig
  state: GameState
  player_ids: string[]
  version: number
  closed: boolean
  created_at: string
  updated_at: string
}

export type Viewer = { id: string; name: string; avatar: string | null }

/** The signed-in user from the `Authorization: Bearer <token>` header, or null. */
export async function getViewer(req: NextRequest): Promise<Viewer | null> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const admin = createAdminClient()
  const { data: { user }, error } = await admin.auth.getUser(token)
  if (error || !user) return null
  const { data: profile } = await admin
    .from('profiles').select('username, avatar, is_banned').eq('id', user.id).single()
  if (profile?.is_banned) return null
  return {
    id: user.id,
    name: (profile?.username || user.email?.split('@')[0] || 'player').slice(0, 24),
    avatar: profile?.avatar ?? null,
  }
}

export function makeCtx(cfg: TableConfig): Ctx {
  return { cfg, now: Date.now(), randInt: (n: number) => randomInt(n) }
}

/** Short, unguessable invite code, e.g. "k3m9x2qa". */
export function newCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let code = ''
  for (let i = 0; i < 10; i++) code += alphabet[randomInt(alphabet.length)]
  return code
}

export async function loadTable(code: string): Promise<{ row: TableRow; secret: Secret } | null> {
  const admin = createAdminClient()
  const { data: row, error } = await admin.from('poker_tables').select('*').eq('code', code).maybeSingle()
  if (error) throw error
  if (!row) return null
  const { data: sec } = await admin.from('poker_table_secrets').select('secret').eq('table_id', row.id).maybeSingle()
  return { row: row as TableRow, secret: (sec?.secret as Secret) ?? { deck: [], hands: {} } }
}

function playerIds(row: TableRow, state: GameState): string[] {
  const ids = new Set<string>([row.host_id])
  for (const p of state.seats) if (p) ids.add(p.userId)
  return Array.from(ids)
}

export type Mutation = (args: { row: TableRow; state: GameState; secret: Secret; ctx: Ctx }) =>
  { state: GameState; secret?: Secret } | null

/**
 * Load → apply → save with optimistic locking. If another request saved first,
 * reload and apply again (the mutation re-validates against fresh state).
 * Returns the saved row, or the unchanged row when the mutation returned null.
 */
export async function mutateTable(code: string, fn: Mutation): Promise<{ row: TableRow; secret: Secret }> {
  const admin = createAdminClient()
  for (let attempt = 0; attempt < 5; attempt++) {
    const loaded = await loadTable(code)
    if (!loaded) throw new GameError('table_not_found')
    const { row, secret } = loaded
    if (row.closed) throw new GameError('table_closed')
    const result = fn({ row, state: row.state, secret, ctx: makeCtx(row.config) })
    if (!result) return loaded
    const { data: newVersion, error } = await admin.rpc('poker_commit', {
      p_table_id: row.id,
      p_version: row.version,
      p_state: result.state,
      p_player_ids: playerIds(row, result.state),
      p_secret: result.secret ?? null,
    })
    if (error) throw error
    if (newVersion !== -1) {
      await saveFinishedHand(row.id, secret.lastHand, result.secret?.lastHand)
      return {
        row: { ...row, state: result.state, version: newVersion as number, player_ids: playerIds(row, result.state) },
        secret: result.secret ?? secret,
      }
    }
    // someone else saved first — small jittered wait, then retry on fresh state
    await new Promise(r => setTimeout(r, 40 + randomInt(80)))
  }
  throw new GameError('busy')
}

/** Store a hand for replays the first time we see it finished (best effort). */
async function saveFinishedHand(tableId: string, before: HandRecord | undefined, after: HandRecord | undefined) {
  if (!after) return
  if (before && before.handNo === after.handNo && before.startedAt === after.startedAt) return
  const { error } = await createAdminClient()
    .from('poker_hands')
    .insert({ table_id: tableId, hand_no: after.handNo, data: after })
  // the history table is optional (supabase/home_games_history.sql); the game must not break without it
  if (error) console.warn('[home-games] could not save hand history:', error.message)
}

/**
 * A finished hand as one viewer may see it: their own hole cards and any cards
 * that were shown to the table; everyone else's cards stay hidden.
 */
export function handForViewer(h: HandRecord, viewerId: string | null) {
  const visible = new Set<number>(h.revealed)
  for (const p of h.players) if (viewerId && p.userId === viewerId) visible.add(p.seat)
  const cards: Record<string, string[]> = {}
  for (const p of h.players) cards[p.seat] = visible.has(p.seat) ? (h.cards[p.seat] ?? []) : []
  return { ...h, cards }
}

/** What one viewer gets: public state plus only their own hole cards. */
export function viewFor(row: TableRow, secret: Secret, viewerId: string | null) {
  const mySeat = viewerId ? seatOf(row.state, viewerId) : -1
  const me = mySeat >= 0 ? row.state.seats[mySeat] : null
  const showCards = !!me && me.inHand && (row.state.phase === 'playing' || row.state.phase === 'handOver')
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    hostId: row.host_id,
    isHost: viewerId === row.host_id,
    config: row.config,
    closed: row.closed,
    version: row.version,
    state: row.state,
    mySeat,
    myCards: showCards ? cardsFor(secret, mySeat) : [],
    serverTime: Date.now(),
  }
}

export type TableView = ReturnType<typeof viewFor>
