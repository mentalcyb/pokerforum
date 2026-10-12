/**
 * No-limit Texas Hold'em engine for private "home game" tables.
 *
 * Pure and deterministic: every function takes the current state and returns a
 * new one (inputs are never mutated). Randomness comes in through `randInt` and
 * time through `now`, so the whole engine can be unit-tested.
 *
 * State is split in two:
 *  - GameState: everything every player at the table may see (stored in
 *    poker_tables.state and pushed to clients in real time)
 *  - Secret: the remaining deck and everyone's hole cards (stored in
 *    poker_table_secrets, readable only by the server)
 */
import { Card, newDeck, shuffle } from './cards'
import { bestScore, compareScores, HandScore } from './evaluate'

export type Street = 'preflop' | 'flop' | 'turn' | 'river'
export type Phase = 'waiting' | 'playing' | 'handOver'

export interface TableConfig {
  smallBlind: number
  bigBlind: number
  startingStack: number
  maxSeats: number
  turnSeconds: number
  /** 'cash' (default): rebuys, fixed blinds. 'tournament': Sit & Go with rising blinds. */
  mode?: 'cash' | 'tournament'
  /** tournament only: minutes per blind level */
  levelMinutes?: number
}

export interface BlindLevel {
  sb: number
  bb: number
}

export interface Placement {
  userId: string
  name: string
  place: number
}

export interface TournamentState {
  levels: BlindLevel[]
  /** current level index (updated when each hand starts) */
  level: number
  levelMinutes: number
  startedAt: number | null
  /** while paused the level clock stands still */
  pausedAt: number | null
  pausedMs: number
  finished: boolean
  entrants: number
  /** finishing positions, best last as they are decided (1st place is added at the end) */
  places: Placement[]
}

export interface Player {
  userId: string
  name: string
  avatar: string | null
  stack: number
  /** chips put in during the current street */
  bet: number
  /** chips put in during the whole hand */
  committed: number
  /** dealt into the current hand */
  inHand: boolean
  folded: boolean
  allIn: boolean
  /** has acted since the last full raise on this street */
  acted: boolean
  sittingOut: boolean
  /** asked to leave during a hand; removed when the hand ends */
  leaving: boolean
  /** consecutive turns that timed out */
  missedTurns: number
  /** asked to show their hole cards to everyone when the hand ends */
  showCards?: boolean
}

export type LogKind =
  | 'blind' | 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin'
  | 'street' | 'win' | 'return' | 'join' | 'leave' | 'rebuy' | 'timeout' | 'sitout' | 'sitin' | 'kick'
  | 'level' | 'out' | 'champion' | 'show'

export interface LogEntry {
  kind: LogKind
  handNo: number
  seat?: number
  name?: string
  amount?: number
  street?: Street
  cards?: Card[]
  /** hand category index (see HAND_CATEGORIES) for showdown wins */
  hand?: number
  /** tournament finishing place, or blind level number for 'level' entries */
  place?: number
  blinds?: BlindLevel
}

export interface PotResult {
  amount: number
  winners: { seat: number; name: string; amount: number }[]
  /** hand category of the winning hand, null when everyone else folded */
  hand: number | null
}

export interface HandResult {
  handNo: number
  pots: PotResult[]
  showdown: boolean
}

export interface LedgerEntry {
  name: string
  boughtIn: number
  cashedOut: number
}

export interface GameState {
  seats: (Player | null)[]
  phase: Phase
  /** host pressed Start at least once; new hands then start automatically */
  started: boolean
  /** host paused: the current hand finishes, no new hands start */
  paused: boolean
  handNo: number
  button: number
  street: Street | null
  board: Card[]
  toAct: number | null
  currentBet: number
  /** size of the last full raise on this street (at least the big blind) */
  minRaise: number
  /** epoch ms when the player to act times out */
  deadline: number | null
  /** epoch ms when the next hand starts */
  nextHandAt: number | null
  /** hole cards shown at showdown, keyed by seat index */
  revealed: Record<string, Card[]>
  lastResult: HandResult | null
  log: LogEntry[]
  /** chips bought in / cashed out per user, for the end-of-night settlement */
  ledger: Record<string, LedgerEntry>
  /** table chat, newest last (optional: tables created before chat existed don't have it) */
  chat?: ChatMessage[]
  /** users the host removed; they can't sit at this table again */
  kicked?: string[]
  /** blinds of the current/last hand (cash: from the config; tournament: from the level) */
  blinds?: BlindLevel
  /** present only for tournament tables */
  tournament?: TournamentState
}

export interface ChatMessage {
  userId: string
  name: string
  text: string
  at: number
}

export interface Secret {
  deck: Card[]
  /** hole cards keyed by seat index */
  hands: Record<string, Card[]>
}

export type Action =
  | { type: 'fold' }
  | { type: 'check' }
  | { type: 'call' }
  /** bet or raise TO this total amount for the street */
  | { type: 'raise'; amount: number }

export class GameError extends Error {
  constructor(public code: string) {
    super(code)
  }
}

export interface Ctx {
  cfg: TableConfig
  now: number
  randInt: (n: number) => number
}

type Result = { state: GameState; secret: Secret }

const LOG_LIMIT = 60
const NEXT_HAND_DELAY_FOLD = 4000
const NEXT_HAND_DELAY_SHOWDOWN = 7000
/** consecutive timeouts before a player is sat out automatically */
const MAX_MISSED_TURNS = 2

// ─── helpers ────────────────────────────────────────────────────────────────

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

function emptySecret(): Secret {
  return { deck: [], hands: {} }
}

function log(s: GameState, e: Omit<LogEntry, 'handNo'>) {
  s.log.push({ ...e, handNo: s.handNo })
  if (s.log.length > LOG_LIMIT) s.log.splice(0, s.log.length - LOG_LIMIT)
}

/** Next occupied seat clockwise after `from` that matches `pred`. */
function nextSeat(s: GameState, from: number, pred: (p: Player, i: number) => boolean): number | null {
  const n = s.seats.length
  for (let k = 1; k <= n; k++) {
    const i = (((from + k) % n) + n) % n
    const p = s.seats[i]
    if (p && pred(p, i)) return i
  }
  return null
}

/**
 * Dealt into the next hand? In tournaments players who sit out are still dealt in
 * (and fold automatically), so they blind away like in a real tournament.
 */
function isEligible(p: Player, s: GameState): boolean {
  if (p.leaving || p.stack <= 0) return false
  return s.tournament ? true : !p.sittingOut
}

const tournamentRunning = (s: GameState) => !!s.tournament && s.started && !s.tournament.finished

const isLive = (p: Player) => p.inHand && !p.folded
const canAct = (p: Player) => p.inHand && !p.folded && !p.allIn

function put(p: Player, amount: number) {
  const a = Math.min(amount, p.stack)
  p.stack -= a
  p.bet += a
  p.committed += a
  if (p.stack === 0) p.allIn = true
  return a
}

function cashOut(s: GameState, seat: number) {
  const p = s.seats[seat]
  if (!p) return
  const entry = s.ledger[p.userId]
  if (entry) entry.cashedOut += p.stack
  log(s, { kind: 'leave', seat, name: p.name, amount: p.stack })
  s.seats[seat] = null
}

export function eligibleCount(s: GameState): number {
  return s.seats.filter((p): p is Player => !!p && isEligible(p, s)).length
}

export function seatOf(s: GameState, userId: string): number {
  return s.seats.findIndex(p => p?.userId === userId)
}

// ─── setup ──────────────────────────────────────────────────────────────────

export function initialState(cfg: TableConfig): GameState {
  return {
    seats: Array.from({ length: cfg.maxSeats }, () => null),
    phase: 'waiting',
    started: false,
    paused: false,
    handNo: 0,
    button: -1,
    street: null,
    board: [],
    toAct: null,
    currentBet: 0,
    minRaise: cfg.bigBlind,
    deadline: null,
    nextHandAt: null,
    revealed: {},
    lastResult: null,
    log: [],
    ledger: {},
    chat: [],
    kicked: [],
    blinds: { sb: cfg.smallBlind, bb: cfg.bigBlind },
    tournament: cfg.mode === 'tournament'
      ? {
          levels: blindStructure(cfg.bigBlind),
          level: 0,
          levelMinutes: cfg.levelMinutes ?? 10,
          startedAt: null,
          pausedAt: null,
          pausedMs: 0,
          finished: false,
          entrants: 0,
          places: [],
        }
      : undefined,
  }
}

// ─── tournament structure ───────────────────────────────────────────────────

const LEVEL_MULTIPLIERS = [1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200, 250, 300, 400, 500]

/** Round to a "chip-friendly" number: 2 significant digits, multiples of 5 from 20 up. */
function niceBlind(x: number): number {
  if (x < 20) return Math.max(2, Math.round(x / 2) * 2)
  const magnitude = Math.pow(10, Math.floor(Math.log10(x)) - 1)
  let v = Math.round(x / magnitude) * magnitude
  if (v >= 20) v = Math.round(v / 10) * 10 || v
  return v
}

/** Standard Sit & Go blind schedule starting from the given big blind. */
export function blindStructure(startBB: number): BlindLevel[] {
  const levels: BlindLevel[] = []
  for (const m of LEVEL_MULTIPLIERS) {
    const bb = m === 1 ? startBB : niceBlind(startBB * m)
    if (levels.length && bb <= levels[levels.length - 1].bb) continue
    levels.push({ sb: Math.max(1, Math.floor(bb / 2)), bb })
  }
  return levels
}

/** Milliseconds of tournament time played (pauses don't count). */
export function tournamentElapsed(t: TournamentState, now: number): number {
  if (t.startedAt === null) return 0
  const pausedNow = t.pausedAt !== null ? now - t.pausedAt : 0
  return Math.max(0, now - t.startedAt - t.pausedMs - pausedNow)
}

export function levelAt(t: TournamentState, now: number): number {
  const levelMs = t.levelMinutes * 60_000
  return Math.min(t.levels.length - 1, Math.floor(tournamentElapsed(t, now) / levelMs))
}

/** Knock out the given seats and record their finishing places (and the champion). */
function eliminate(s: GameState, seats: { seat: number; chips: number }[]) {
  const t = s.tournament!
  if (seats.length === 0) return
  const out = new Set(seats.map(x => x.seat))
  const remaining = s.seats.filter((p, i): p is Player => !!p && !out.has(i)).length
  // more chips at the start of the hand = better finish
  const ordered = seats.slice().sort((a, b) => b.chips - a.chips)
  ordered.forEach((x, k) => {
    const p = s.seats[x.seat]!
    const place = remaining + 1 + k
    t.places.push({ userId: p.userId, name: p.name, place })
    log(s, { kind: 'out', seat: x.seat, name: p.name, place })
    s.seats[x.seat] = null
  })
  const left = s.seats.map((p, i) => ({ p, i })).filter(x => !!x.p)
  if (left.length <= 1) {
    t.finished = true
    s.started = false
    const champ = left[0]
    if (champ) {
      t.places.push({ userId: champ.p!.userId, name: champ.p!.name, place: 1 })
      log(s, { kind: 'champion', seat: champ.i, name: champ.p!.name, place: 1 })
    }
  }
}

export function validateConfig(cfg: TableConfig): string | null {
  const ints = [cfg.smallBlind, cfg.bigBlind, cfg.startingStack, cfg.maxSeats, cfg.turnSeconds]
  if (!ints.every(v => Number.isInteger(v) && v > 0)) return 'invalid_config'
  if (cfg.smallBlind > cfg.bigBlind) return 'invalid_blinds'
  if (cfg.bigBlind > 1_000_000) return 'invalid_blinds'
  if (cfg.startingStack < cfg.bigBlind * 10 || cfg.startingStack > 10_000_000) return 'invalid_stack'
  if (cfg.maxSeats < 2 || cfg.maxSeats > 9) return 'invalid_seats'
  if (cfg.turnSeconds < 10 || cfg.turnSeconds > 120) return 'invalid_timer'
  if (cfg.mode !== undefined && cfg.mode !== 'cash' && cfg.mode !== 'tournament') return 'invalid_config'
  if (cfg.mode === 'tournament') {
    const m = cfg.levelMinutes
    if (!Number.isInteger(m) || m! < 1 || m! > 60) return 'invalid_level_time'
  }
  return null
}

// ─── seating ────────────────────────────────────────────────────────────────

export function sit(
  state: GameState,
  cfg: TableConfig,
  seat: number,
  user: { userId: string; name: string; avatar: string | null },
): GameState {
  const s = clone(state)
  if (!Number.isInteger(seat) || seat < 0 || seat >= s.seats.length) throw new GameError('invalid_seat')
  if (s.seats[seat]) throw new GameError('seat_taken')
  if (seatOf(s, user.userId) >= 0) throw new GameError('already_seated')
  if (s.kicked?.includes(user.userId)) throw new GameError('kicked')
  if (tournamentRunning(s)) throw new GameError('tournament_running')
  s.seats[seat] = {
    userId: user.userId,
    name: user.name,
    avatar: user.avatar,
    stack: cfg.startingStack,
    bet: 0,
    committed: 0,
    inHand: false,
    folded: false,
    allIn: false,
    acted: false,
    sittingOut: false,
    leaving: false,
    missedTurns: 0,
  }
  const entry = s.ledger[user.userId] ?? { name: user.name, boughtIn: 0, cashedOut: 0 }
  entry.name = user.name
  entry.boughtIn += cfg.startingStack
  s.ledger[user.userId] = entry
  log(s, { kind: 'join', seat, name: user.name, amount: cfg.startingStack })
  return s
}

export function rebuy(state: GameState, cfg: TableConfig, seat: number): GameState {
  const s = clone(state)
  const p = s.seats[seat]
  if (!p) throw new GameError('not_seated')
  if (s.tournament) throw new GameError('no_rebuy')
  if (p.stack > 0) throw new GameError('still_has_chips')
  if (s.phase === 'playing' && isLive(p)) throw new GameError('in_hand')
  p.stack = cfg.startingStack
  s.ledger[p.userId].boughtIn += cfg.startingStack
  log(s, { kind: 'rebuy', seat, name: p.name, amount: cfg.startingStack })
  return s
}

export function setSittingOut(state: GameState, seat: number, out: boolean): GameState {
  const s = clone(state)
  const p = s.seats[seat]
  if (!p) throw new GameError('not_seated')
  if (p.sittingOut === out) return s
  p.sittingOut = out
  p.missedTurns = 0
  log(s, { kind: out ? 'sitout' : 'sitin', seat, name: p.name })
  return s
}

/** Leave the table. Mid-hand the player folds first and is removed when the hand ends. */
export function leave(state: GameState, secret: Secret, ctx: Ctx, seat: number): Result {
  const p = state.seats[seat]
  if (!p) throw new GameError('not_seated')
  let s = clone(state)
  let sec = clone(secret)

  if (s.phase === 'playing' && isLive(p)) {
    if (s.toAct === seat) {
      ;({ state: s, secret: sec } = act(s, sec, ctx, seat, { type: 'fold' }, true))
    } else {
      const q = s.seats[seat]!
      q.folded = true
      log(s, { kind: 'fold', seat, name: q.name })
      if (s.seats.filter((x): x is Player => !!x && isLive(x)).length === 1) {
        ;({ state: s, secret: sec } = endHand(s, sec, ctx, false))
      }
    }
  }

  const q = s.seats[seat]
  if (!q) return { state: s, secret: sec } // already removed at hand end
  if (s.phase === 'playing' && q.inHand) {
    q.leaving = true // chips are settled when the hand ends
  } else if (tournamentRunning(s)) {
    eliminate(s, [{ seat, chips: -1 }]) // leaving a running tournament forfeits
  } else {
    cashOut(s, seat)
  }
  return { state: s, secret: sec }
}

// ─── host controls ──────────────────────────────────────────────────────────

export function startGame(state: GameState, secret: Secret, ctx: Ctx): Result {
  const s = clone(state)
  const t = s.tournament
  if (t && (!s.started || t.finished)) {
    // (re)start a tournament: everyone seated gets a fresh starting stack
    for (const p of s.seats) {
      if (!p) continue
      p.stack = ctx.cfg.startingStack
      p.sittingOut = false
      p.missedTurns = 0
    }
    if (eligibleCount(s) < 2) throw new GameError('not_enough_players')
    t.levels = blindStructure(ctx.cfg.bigBlind)
    t.levelMinutes = ctx.cfg.levelMinutes ?? t.levelMinutes
    t.level = 0
    t.startedAt = ctx.now
    t.pausedAt = null
    t.pausedMs = 0
    t.finished = false
    t.places = []
    t.entrants = eligibleCount(s)
    s.button = -1
    s.handNo = 0
    s.started = true
    s.paused = false
    log(s, { kind: 'level', place: 1, blinds: t.levels[0] })
    return startHand(s, secret, ctx)
  }
  if (eligibleCount(s) < 2) throw new GameError('not_enough_players')
  s.started = true
  s.paused = false
  if (s.phase === 'playing') return { state: s, secret }
  return startHand(s, secret, ctx)
}

export function setPaused(state: GameState, paused: boolean, now: number = Date.now()): GameState {
  const s = clone(state)
  const t = s.tournament
  if (t && t.startedAt !== null && !t.finished) {
    if (paused && t.pausedAt === null) t.pausedAt = now
    if (!paused && t.pausedAt !== null) { t.pausedMs += now - t.pausedAt; t.pausedAt = null }
  }
  s.paused = paused
  return s
}

// ─── hands ──────────────────────────────────────────────────────────────────

export function startHand(state: GameState, _secret: Secret, ctx: Ctx): Result {
  const { cfg, now, randInt } = ctx
  const s = clone(state)

  // players who left during the last hand go now
  if (tournamentRunning(s)) {
    eliminate(s, s.seats.map((p, i) => ({ p, seat: i })).filter(x => x.p?.leaving).map(x => ({ seat: x.seat, chips: -1 })))
  } else {
    s.seats.forEach((p, i) => { if (p?.leaving) cashOut(s, i) })
  }

  for (const p of s.seats) {
    if (!p) continue
    p.bet = 0
    p.committed = 0
    p.folded = false
    p.allIn = false
    p.acted = false
    p.inHand = false
    p.showCards = false
  }
  s.board = []
  s.revealed = {}
  s.toAct = null
  s.deadline = null
  s.nextHandAt = null
  s.currentBet = 0

  // Blinds for this hand: fixed at a cash table, by the level clock in a tournament.
  let blinds: BlindLevel = { sb: cfg.smallBlind, bb: cfg.bigBlind }
  const t = s.tournament
  if (t && t.startedAt !== null) {
    const level = levelAt(t, now)
    if (level !== t.level) {
      t.level = level
      log(s, { kind: 'level', place: level + 1, blinds: t.levels[level] })
    }
    blinds = t.levels[t.level]
  }
  s.blinds = blinds
  s.minRaise = blinds.bb

  if (s.paused || eligibleCount(s) < 2 || t?.finished) {
    s.phase = 'waiting'
    s.street = null
    return { state: s, secret: emptySecret() }
  }

  for (const p of s.seats) if (p) p.inHand = isEligible(p, s)
  const dealt = s.seats.filter((p): p is Player => !!p && p.inHand).length

  s.handNo += 1
  s.phase = 'playing'
  s.street = 'preflop'
  s.lastResult = null
  s.button = nextSeat(s, s.button, p => p.inHand)!

  // Heads-up: the button posts the small blind and acts first before the flop.
  const sb = dealt === 2 ? s.button : nextSeat(s, s.button, p => p.inHand)!
  const bb = nextSeat(s, sb, p => p.inHand)!
  log(s, { kind: 'blind', seat: sb, name: s.seats[sb]!.name, amount: put(s.seats[sb]!, blinds.sb) })
  log(s, { kind: 'blind', seat: bb, name: s.seats[bb]!.name, amount: put(s.seats[bb]!, blinds.bb) })
  s.currentBet = blinds.bb
  s.minRaise = blinds.bb

  // Deal two cards to each player, one at a time, starting left of the button.
  const deck = shuffle(newDeck(), randInt)
  const order: number[] = []
  let seat = s.button
  for (let k = 0; k < dealt; k++) {
    seat = nextSeat(s, seat, p => p.inHand)!
    order.push(seat)
  }
  const hands: Record<string, Card[]> = {}
  for (let round = 0; round < 2; round++) {
    for (const i of order) (hands[i] ??= []).push(deck.pop()!)
  }

  return advance(s, { deck, hands }, ctx, bb)
}

/**
 * Apply a player's action. `auto` is true for timeouts and leaving, which
 * shouldn't reset the missed-turn counter.
 */
export function act(state: GameState, secret: Secret, ctx: Ctx, seat: number, action: Action, auto = false): Result {
  if (state.phase !== 'playing' || state.toAct !== seat) throw new GameError('not_your_turn')
  const s = clone(state)
  const sec = clone(secret)
  const p = s.seats[seat]!
  const toCall = s.currentBet - p.bet

  switch (action.type) {
    case 'fold':
      p.folded = true
      log(s, { kind: 'fold', seat, name: p.name })
      break
    case 'check':
      if (toCall > 0) throw new GameError('cannot_check')
      log(s, { kind: 'check', seat, name: p.name })
      break
    case 'call': {
      if (toCall <= 0) throw new GameError('nothing_to_call')
      const paid = put(p, toCall)
      log(s, { kind: p.allIn ? 'allin' : 'call', seat, name: p.name, amount: p.allIn ? p.bet : paid })
      break
    }
    case 'raise': {
      // A player who already acted may only raise again if a full raise reopened the betting.
      if (p.acted) throw new GameError('cannot_raise')
      const to = Math.floor(Number(action.amount))
      const maxTo = p.bet + p.stack
      if (!Number.isFinite(to) || to <= s.currentBet) throw new GameError('raise_too_small')
      if (to > maxTo) throw new GameError('not_enough_chips')
      const raiseSize = to - s.currentBet
      // Going all-in for less than a full raise is always allowed.
      if (to < maxTo && raiseSize < s.minRaise) throw new GameError('raise_too_small')
      const wasBet = s.currentBet === 0
      put(p, to - p.bet)
      if (raiseSize >= s.minRaise) {
        s.minRaise = raiseSize
        // a full raise reopens the action for everyone else
        for (const q of s.seats) if (q && q !== p && canAct(q)) q.acted = false
      }
      s.currentBet = to
      log(s, { kind: p.allIn ? 'allin' : wasBet ? 'bet' : 'raise', seat, name: p.name, amount: to })
      break
    }
    default:
      throw new GameError('invalid_action')
  }

  p.acted = true
  if (!auto) p.missedTurns = 0
  return advance(s, sec, ctx, seat)
}

/** Handle the turn timer and the pause between hands. Safe to call any time. */
export function tick(state: GameState, secret: Secret, ctx: Ctx): Result | null {
  const { now } = ctx

  const turnPlayer = state.phase === 'playing' && state.toAct !== null ? state.seats[state.toAct] : null
  // Players already sat out for missing turns don't hold up the table again.
  const autoSkip = !!turnPlayer && (turnPlayer.missedTurns >= MAX_MISSED_TURNS || turnPlayer.sittingOut)
  if (turnPlayer && state.deadline !== null && (now >= state.deadline || autoSkip)) {
    const seat = state.toAct!
    const s = clone(state)
    const p = s.seats[seat]!
    p.missedTurns += 1
    if (!autoSkip) log(s, { kind: 'timeout', seat, name: p.name })
    if (p.missedTurns >= MAX_MISSED_TURNS && !p.sittingOut) {
      p.sittingOut = true
      log(s, { kind: 'sitout', seat, name: p.name })
    }
    const action: Action = p.bet >= s.currentBet ? { type: 'check' } : { type: 'fold' }
    return act(s, secret, ctx, seat, action, true)
  }

  if (state.phase === 'handOver' && state.nextHandAt !== null && now >= state.nextHandAt) {
    return startHand(state, secret, ctx)
  }

  // Game is running but was waiting for players (someone left, rebought or sat back in)
  if (state.phase === 'waiting' && state.started && !state.paused && eligibleCount(state) >= 2) {
    return startHand(state, secret, ctx)
  }

  return null
}

/** Start a player's turn. Players who are sitting out check or fold straight away. */
function giveTurn(s: GameState, sec: Secret, ctx: Ctx, seat: number): Result {
  s.toAct = seat
  s.deadline = ctx.now + ctx.cfg.turnSeconds * 1000
  const p = s.seats[seat]!
  if (p.sittingOut) {
    return act(s, sec, ctx, seat, p.bet >= s.currentBet ? { type: 'check' } : { type: 'fold' }, true)
  }
  return { state: s, secret: sec }
}

/** After an action: pick the next player, move to the next street, or finish the hand. */
function advance(s: GameState, sec: Secret, ctx: Ctx, fromSeat: number): Result {
  const { cfg } = ctx
  const players = s.seats.filter((p): p is Player => !!p)
  const live = players.filter(isLive)
  if (live.length === 1) return endHand(s, sec, ctx, false)

  const actors = players.filter(canAct)
  let pending = actors.filter(p => !p.acted || p.bet < s.currentBet)
  // Everyone else is all-in and this player has matched the bet: nothing left to decide.
  if (actors.length === 1 && actors[0].bet >= s.currentBet) pending = []

  if (pending.length > 0) {
    return giveTurn(s, sec, ctx, nextSeat(s, fromSeat, p => pending.includes(p))!)
  }

  // Betting round complete
  for (const p of players) { p.bet = 0; p.acted = false }
  s.currentBet = 0
  s.minRaise = s.blinds?.bb ?? cfg.bigBlind
  s.toAct = null
  s.deadline = null

  const runOut = actors.length <= 1
  while (s.street !== 'river') {
    sec.deck.pop() // burn
    if (s.street === 'preflop') {
      s.board.push(sec.deck.pop()!, sec.deck.pop()!, sec.deck.pop()!)
      s.street = 'flop'
    } else if (s.street === 'flop') {
      s.board.push(sec.deck.pop()!)
      s.street = 'turn'
    } else {
      s.board.push(sec.deck.pop()!)
      s.street = 'river'
    }
    log(s, { kind: 'street', street: s.street, cards: s.board.slice() })
    if (!runOut) {
      return giveTurn(s, sec, ctx, nextSeat(s, s.button, canAct)!)
    }
  }
  return endHand(s, sec, ctx, true)
}

/** Split the chips into the main pot and side pots, award them, and end the hand. */
function endHand(s: GameState, sec: Secret, ctx: Ctx, showdown: boolean): Result {
  const players = s.seats
    .map((p, seat) => ({ p, seat }))
    .filter((x): x is { p: Player; seat: number } => !!x.p && x.p.inHand)
  const live = players.filter(x => !x.p.folded)

  // Uncalled bet: if one player put in more than anyone else, the excess simply goes back.
  const byCommitted = players.slice().sort((a, b) => b.p.committed - a.p.committed)
  if (byCommitted.length >= 2) {
    const [top, second] = byCommitted
    const excess = top.p.committed - second.p.committed
    // (a player who folded forfeits everything they put in)
    if (excess > 0 && !top.p.folded) {
      top.p.committed -= excess
      top.p.stack += excess
      log(s, { kind: 'return', seat: top.seat, name: top.p.name, amount: excess })
    }
  }

  // Pots by contribution level: every distinct amount someone put in starts a new layer.
  const levels = Array.from(new Set(players.map(x => x.p.committed).filter(c => c > 0))).sort((a, b) => a - b)
  type Pot = { amount: number; eligible: number[] }
  const pots: Pot[] = []
  let prev = 0
  for (const level of levels) {
    const amount = players.reduce((sum, x) => sum + Math.max(0, Math.min(x.p.committed, level) - prev), 0)
    const eligible = live.filter(x => x.p.committed >= level).map(x => x.seat)
    prev = level
    if (amount === 0) continue
    const last = pots[pots.length - 1]
    if (eligible.length === 0 && last) last.amount += amount // only folded players reached this level
    else if (last && last.eligible.join() === eligible.join()) last.amount += amount
    else pots.push({ amount, eligible: eligible.length ? eligible : live.map(x => x.seat) })
  }

  const scores = new Map<number, HandScore>()
  if (showdown) {
    for (const x of live) {
      scores.set(x.seat, bestScore([...(sec.hands[x.seat] ?? []), ...s.board]))
      s.revealed[x.seat] = sec.hands[x.seat] ?? []
    }
  }
  // players who chose "show cards" during the hand (e.g. after folding)
  for (const x of players) {
    if (x.p.showCards && !s.revealed[x.seat] && sec.hands[x.seat]) {
      s.revealed[x.seat] = sec.hands[x.seat]
      log(s, { kind: 'show', seat: x.seat, name: x.p.name, cards: sec.hands[x.seat] })
    }
  }

  // Clockwise order from the button decides who gets odd chips.
  const clockwise = (seat: number) => (seat - s.button - 1 + s.seats.length) % s.seats.length

  const results: PotResult[] = []
  for (const pot of pots) {
    let winners = pot.eligible
    let hand: number | null = null
    if (showdown && pot.eligible.length > 1) {
      let best: HandScore | null = null
      for (const seat of pot.eligible) {
        const sc = scores.get(seat)!
        const cmp = best ? compareScores(sc, best) : 1
        if (cmp > 0) { best = sc; winners = [seat] }
        else if (cmp === 0) winners = [...winners, seat]
      }
      hand = best![0]
    } else if (showdown) {
      hand = scores.get(pot.eligible[0])?.[0] ?? null
    }
    winners = winners.slice().sort((a, b) => clockwise(a) - clockwise(b))
    const share = Math.floor(pot.amount / winners.length)
    let odd = pot.amount - share * winners.length
    const paid = winners.map(seat => {
      const amount = share + (odd > 0 ? 1 : 0)
      if (odd > 0) odd--
      const p = s.seats[seat]!
      p.stack += amount
      return { seat, name: p.name, amount }
    })
    for (const w of paid) {
      log(s, { kind: 'win', seat: w.seat, name: w.name, amount: w.amount, hand: hand ?? undefined })
    }
    results.push({ amount: pot.amount, winners: paid, hand })
  }

  // all chips are now back in stacks
  // Tournament: players who lost all their chips (or left) are out
  if (tournamentRunning(s)) {
    eliminate(s, players
      .filter(x => s.seats[x.seat] && (x.p.stack === 0 || x.p.leaving))
      .map(x => ({ seat: x.seat, chips: x.p.leaving ? -1 : x.p.committed })))
  }

  for (const x of players) { x.p.bet = 0; x.p.committed = 0; x.p.acted = false }
  s.phase = 'handOver'
  s.toAct = null
  s.deadline = null
  s.currentBet = 0
  s.lastResult = { handNo: s.handNo, pots: results, showdown }
  s.nextHandAt = ctx.now + (showdown ? NEXT_HAND_DELAY_SHOWDOWN : NEXT_HAND_DELAY_FOLD)

  // players who asked to leave go now that their chips are settled
  s.seats.forEach((p, i) => { if (p?.leaving) cashOut(s, i) })

  return { state: s, secret: sec }
}

/** What a given viewer may see. Hole cards are only ever sent to their owner. */
// ─── host tools & chat ──────────────────────────────────────────────────────

/** Host removes a player: same as them leaving, and they can't sit here again. */
export function kick(state: GameState, secret: Secret, ctx: Ctx, seat: number): Result {
  const p = state.seats[seat]
  if (!p) throw new GameError('not_seated')
  const r = leave(state, secret, ctx, seat)
  r.state.kicked = Array.from(new Set([...(r.state.kicked ?? []), p.userId]))
  log(r.state, { kind: 'kick', seat, name: p.name })
  return r
}

const CHAT_LIMIT = 50
const CHAT_MAX_LENGTH = 200
const CHAT_MIN_INTERVAL_MS = 800

export function addChat(state: GameState, user: { userId: string; name: string }, text: string, now: number): GameState {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, CHAT_MAX_LENGTH)
  if (!clean) throw new GameError('empty_message')
  const s = clone(state)
  const chat = s.chat ?? []
  const last = [...chat].reverse().find(m => m.userId === user.userId)
  if (last && now - last.at < CHAT_MIN_INTERVAL_MS) throw new GameError('too_fast')
  chat.push({ userId: user.userId, name: user.name, text: clean, at: now })
  if (chat.length > CHAT_LIMIT) chat.splice(0, chat.length - CHAT_LIMIT)
  s.chat = chat
  return s
}

/**
 * Show your hole cards to the table. During a hand the request is remembered and the
 * cards are turned over when the hand ends, so folded cards can't influence the hand.
 */
export function showCards(state: GameState, secret: Secret, seat: number): GameState {
  const s = clone(state)
  const p = s.seats[seat]
  if (!p) throw new GameError('not_seated')
  const cards = secret.hands[seat]
  if (!p.inHand || !cards?.length || s.phase === 'waiting') throw new GameError('no_cards')
  if (s.revealed[seat]) return s
  if (s.phase === 'playing') {
    p.showCards = true
  } else {
    s.revealed[seat] = cards
    log(s, { kind: 'show', seat, name: p.name, cards })
  }
  return s
}

export function cardsFor(secret: Secret, seat: number): Card[] {
  return secret.hands[seat] ?? []
}
