// Run with: npm run test:poker
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  act, Ctx, GameError, GameState, initialState, leave, rebuy, Secret, sit, startGame, startHand,
  TableConfig, tick, Action, kick, addChat, blindStructure, setPaused, setSittingOut,
} from '../engine'
import { bestScore, compareScores, score5, handCategory } from '../evaluate'

const cfg: TableConfig = { smallBlind: 5, bigBlind: 10, startingStack: 1000, maxSeats: 6, turnSeconds: 30 }

let clock = 1_000_000
function ctx(over: Partial<Ctx> = {}): Ctx {
  let seed = 12345
  return {
    cfg,
    now: clock,
    // small deterministic LCG so tests are repeatable
    randInt: (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n },
    ...over,
  }
}

function table(names: string[], seats?: number[], config = cfg): GameState {
  let s = initialState(config)
  names.forEach((name, k) => {
    s = sit(s, config, seats ? seats[k] : k, { userId: `u-${name}`, name, avatar: null })
  })
  return s
}

function totalChips(s: GameState): number {
  return s.seats.reduce((sum, p) => sum + (p ? p.stack + p.committed : 0), 0)
}

function stackOf(s: GameState, name: string): number {
  return s.seats.find(p => p?.name === name)!.stack
}

function seatOfName(s: GameState, name: string): number {
  return s.seats.findIndex(p => p?.name === name)
}

/** Replace hole cards and the rest of the deck so the board comes out as given. */
function rig(sec: Secret, hands: Record<number, string[]>, board: string[]): Secret {
  // board is drawn with pop(): burn, flop×3, burn, turn, burn, river
  const draws = ['XX', board[0], board[1], board[2], 'XX', board[3], 'XX', board[4]]
  return { hands: { ...sec.hands, ...hands }, deck: draws.reverse() }
}

function play(r: { state: GameState; secret: Secret }, seat: number, a: Action, c = ctx()) {
  return act(r.state, r.secret, c, seat, a)
}

// ─── evaluator ─────────────────────────────────────────────────────────────

test('evaluator ranks hand categories correctly', () => {
  const cat = (cards: string) => score5(cards.split(' '))[0]
  assert.equal(cat('As Kd 9h 7c 3s'), 0)
  assert.equal(cat('As Ad 9h 7c 3s'), 1)
  assert.equal(cat('As Ad 9h 9c 3s'), 2)
  assert.equal(cat('As Ad Ah 7c 3s'), 3)
  assert.equal(cat('5s 4d 3h 2c As'), 4) // wheel
  assert.equal(cat('As Js 9s 7s 3s'), 5)
  assert.equal(cat('As Ad Ah 7c 7s'), 6)
  assert.equal(cat('As Ad Ah Ac 3s'), 7)
  assert.equal(cat('9s 8s 7s 6s 5s'), 8)
})

test('evaluator compares kickers and picks best five of seven', () => {
  const s = (c: string) => bestScore(c.split(' '))
  assert.ok(compareScores(s('As Ad Kh 7c 3s 2d 4h'), s('Ac Ah Qh 7d 3c 2s 4d')) > 0) // kicker K beats Q
  assert.equal(compareScores(s('As Ad Kh Qc Js 2d 3h'), s('Ac Ah Kd Qh Jc 4s 5d')), 0) // same five cards
  assert.ok(compareScores(s('6s 5d 4h 3c 2s Kd Kh'), s('5s 4d 3h 2c As Kc Ks')) > 0) // 6-high straight beats wheel
  assert.equal(s('As 2s 3s 4s 5s Kd Kh')[0], 8) // steel wheel
})

// ─── blinds and order ──────────────────────────────────────────────────────

test('heads-up: button posts small blind and acts first preflop, last postflop', () => {
  let r = startGame(table(['A', 'B']), { deck: [], hands: {} }, ctx())
  const btn = r.state.button
  const other = btn === 0 ? 1 : 0
  assert.equal(r.state.seats[btn]!.bet, 5)
  assert.equal(r.state.seats[other]!.bet, 10)
  assert.equal(r.state.toAct, btn)
  r = play(r, btn, { type: 'call' })
  assert.equal(r.state.toAct, other, 'big blind gets the option')
  r = play(r, other, { type: 'check' })
  assert.equal(r.state.street, 'flop')
  assert.equal(r.state.board.length, 3)
  assert.equal(r.state.toAct, other, 'non-button acts first after the flop')
})

test('three players: blinds left of the button, button acts first preflop', () => {
  const r = startGame(table(['A', 'B', 'C']), { deck: [], hands: {} }, ctx())
  const { button } = r.state
  assert.equal(button, 0)
  assert.equal(r.state.seats[1]!.bet, 5)
  assert.equal(r.state.seats[2]!.bet, 10)
  assert.equal(r.state.toAct, 0)
  assert.equal(Object.keys(r.secret.hands).length, 3)
  for (const cards of Object.values(r.secret.hands)) assert.equal(cards.length, 2)
  assert.equal(r.secret.deck.length, 52 - 6)
})

test('everyone folds to the big blind', () => {
  let r = startGame(table(['A', 'B', 'C']), { deck: [], hands: {} }, ctx())
  r = play(r, 0, { type: 'fold' })
  r = play(r, 1, { type: 'fold' })
  assert.equal(r.state.phase, 'handOver')
  assert.equal(stackOf(r.state, 'C'), 1005)
  assert.equal(stackOf(r.state, 'B'), 995)
  assert.deepEqual(r.state.revealed, {}, 'no cards shown without a showdown')
  assert.equal(totalChips(r.state), 3000)
})

// ─── betting rules ─────────────────────────────────────────────────────────

test('minimum raise is enforced and a full raise reopens the action', () => {
  let r = startGame(table(['A', 'B', 'C']), { deck: [], hands: {} }, ctx())
  assert.throws(() => play(r, 0, { type: 'raise', amount: 15 }), (e: GameError) => e.code === 'raise_too_small')
  assert.throws(() => play(r, 0, { type: 'check' }), (e: GameError) => e.code === 'cannot_check')
  r = play(r, 0, { type: 'raise', amount: 30 }) // raise of 20
  assert.throws(() => play(r, 1, { type: 'raise', amount: 40 }), (e: GameError) => e.code === 'raise_too_small')
  r = play(r, 1, { type: 'raise', amount: 50 }) // min re-raise: 30 + 20
  assert.equal(r.state.currentBet, 50)
  assert.equal(r.state.minRaise, 20)
  r = play(r, 2, { type: 'call' })
  assert.equal(r.state.toAct, 0, 'original raiser must respond')
  r = play(r, 0, { type: 'raise', amount: 120 })
  assert.equal(r.state.minRaise, 70)
})

test('an all-in for less than a full raise does not reopen the betting', () => {
  // C has only 45 chips
  let s = table(['A', 'B', 'C'])
  s.seats[2]!.stack = 45
  let r = startGame(s, { deck: [], hands: {} }, ctx()) // A btn, B sb, C bb (posts 10, 35 left)
  r = play(r, 0, { type: 'raise', amount: 30 })
  r = play(r, 1, { type: 'call' })
  r = play(r, 2, { type: 'raise', amount: 45 }) // all-in, raise of only 15
  assert.equal(r.state.seats[2]!.allIn, true)
  assert.equal(r.state.currentBet, 45)
  assert.equal(r.state.toAct, 0)
  assert.throws(() => play(r, 0, { type: 'raise', amount: 100 }), (e: GameError) => e.code === 'cannot_raise')
  r = play(r, 0, { type: 'call' })
  r = play(r, 1, { type: 'call' })
  assert.equal(r.state.street, 'flop')
})

test('big blind can raise when the action is limped around', () => {
  let r = startGame(table(['A', 'B', 'C']), { deck: [], hands: {} }, ctx())
  r = play(r, 0, { type: 'call' })
  r = play(r, 1, { type: 'call' })
  assert.equal(r.state.toAct, 2)
  r = play(r, 2, { type: 'raise', amount: 40 })
  assert.equal(r.state.street, 'preflop')
  assert.equal(r.state.toAct, 0)
})

// ─── showdown and pots ─────────────────────────────────────────────────────

test('side pots: short all-in can only win what it covered', () => {
  const s = table(['A', 'B', 'C'])
  s.seats[0]!.stack = 100 // A short
  let r = startGame(s, { deck: [], hands: {} }, ctx()) // A btn, B sb, C bb
  // A has the best hand, B second best, C worst
  r.secret = rig(r.secret, { 0: ['As', 'Ah'], 1: ['Ks', 'Kh'], 2: ['7c', '2d'] }, ['Ad', '9c', '5h', '3s', 'Jd'])
  r = play(r, 0, { type: 'raise', amount: 100 }) // all-in
  r = play(r, 1, { type: 'raise', amount: 400 })
  r = play(r, 2, { type: 'call' })
  assert.equal(r.state.phase, 'playing')
  assert.equal(r.state.street, 'flop')
  // B and C still have chips: check it down
  r = play(r, 1, { type: 'check' })
  r = play(r, 2, { type: 'check' })
  r = play(r, 1, { type: 'check' })
  r = play(r, 2, { type: 'check' })
  r = play(r, 1, { type: 'check' })
  r = play(r, 2, { type: 'check' })
  assert.equal(r.state.phase, 'handOver')
  assert.equal(stackOf(r.state, 'A'), 300, 'main pot: 100 × 3')
  assert.equal(stackOf(r.state, 'B'), 600 + 600, 'side pot: 300 × 2')
  assert.equal(stackOf(r.state, 'C'), 600)
  assert.equal(totalChips(r.state), 2100)
  assert.equal(r.state.lastResult!.pots.length, 2)
  assert.deepEqual(Object.keys(r.state.revealed).sort(), ['0', '1', '2'])
})

test('all-in preflop runs out the board automatically', () => {
  let r = startGame(table(['A', 'B']), { deck: [], hands: {} }, ctx())
  const btn = r.state.button, other = 1 - btn
  r.secret = rig(r.secret, { [btn]: ['As', 'Ad'], [other]: ['Kc', 'Kd'] }, ['2h', '7s', '9d', 'Jc', '3h'])
  r = play(r, btn, { type: 'raise', amount: 1000 })
  r = play(r, other, { type: 'call' })
  assert.equal(r.state.phase, 'handOver')
  assert.equal(r.state.board.length, 5)
  assert.equal(r.state.seats[btn]!.stack, 2000)
  assert.equal(r.state.seats[other]!.stack, 0)
  assert.equal(r.state.lastResult!.pots[0].hand, 1)
})

test('uncalled part of a bet goes back to the bettor', () => {
  const s = table(['A', 'B'])
  s.seats[1]!.stack = 200
  let r = startGame(s, { deck: [], hands: {} }, ctx())
  const btn = r.state.button, other = 1 - btn
  r.secret = rig(r.secret, { [btn]: ['2c', '7d'], [other]: ['As', 'Ad'] }, ['Kh', 'Qs', '9d', '4c', '3h'])
  const big = r.state.seats[btn]!.stack + r.state.seats[btn]!.bet
  r = play(r, btn, { type: 'raise', amount: big }) // A shoves 1000, B has 200
  r = play(r, other, { type: 'call' })
  assert.equal(r.state.phase, 'handOver')
  assert.equal(r.state.seats[other]!.stack, 400)
  assert.equal(r.state.seats[btn]!.stack, 800)
  assert.ok(r.state.log.some(e => e.kind === 'return' && e.amount === 800))
})

test('split pot gives the odd chip to the first player left of the button', () => {
  let r = startGame(table(['A', 'B', 'C']), { deck: [], hands: {} }, ctx()) // A btn(0), B sb(1), C bb(2)
  // Broadway on the board: B and C tie
  r.secret = rig(r.secret, { 0: ['2c', '3d'], 1: ['4s', '5h'], 2: ['6d', '7c'] }, ['Ah', 'Kh', 'Qd', 'Jc', 'Ts'])
  r = play(r, 0, { type: 'raise', amount: 25 })
  r = play(r, 1, { type: 'call' })
  r = play(r, 2, { type: 'call' })
  r = play(r, 1, { type: 'check' })
  r = play(r, 2, { type: 'raise', amount: 10 })
  r = play(r, 0, { type: 'fold' })
  r = play(r, 1, { type: 'call' })
  for (let k = 0; k < 4; k++) r = play(r, r.state.toAct!, { type: 'check' })
  assert.equal(r.state.phase, 'handOver')
  assert.equal(r.state.lastResult!.pots[0].amount, 95)
  assert.equal(stackOf(r.state, 'B'), 1000 - 35 + 48)
  assert.equal(stackOf(r.state, 'C'), 1000 - 35 + 47)
  assert.equal(stackOf(r.state, 'A'), 975)
  assert.equal(totalChips(r.state), 3000)
})

// ─── timers, seating, flow ─────────────────────────────────────────────────

test('timeout checks when possible, otherwise folds; two misses sit the player out', () => {
  let r = startGame(table(['A', 'B', 'C']), { deck: [], hands: {} }, ctx())
  assert.equal(tick(r.state, r.secret, ctx()), null, 'nothing happens before the deadline')
  const late = ctx({ now: r.state.deadline! + 1 })
  r = tick(r.state, r.secret, late)! // A faces the big blind → folds
  assert.equal(r.state.seats[0]!.folded, true)
  assert.equal(r.state.seats[0]!.missedTurns, 1)
  r = play(r, 1, { type: 'call' })
  r = tick(r.state, r.secret, ctx({ now: r.state.deadline! + 1 }))! // C can check
  assert.equal(r.state.street, 'flop')
  assert.equal(r.state.seats[2]!.folded, false)
  // Next hand: A times out again and is sat out
  r = startHand(r.state, r.secret, ctx())
  const a = seatOfName(r.state, 'A')
  while (r.state.phase === 'playing' && r.state.toAct !== a) r = play(r, r.state.toAct!, r.state.seats[r.state.toAct!]!.bet < r.state.currentBet ? { type: 'call' } : { type: 'check' })
  if (r.state.phase === 'playing') {
    r = tick(r.state, r.secret, ctx({ now: r.state.deadline! + 1 }))!
    assert.equal(r.state.seats[a]!.sittingOut, true)
  }
})

test('next hand starts automatically after the pause and the button moves', () => {
  let r = startGame(table(['A', 'B', 'C']), { deck: [], hands: {} }, ctx())
  const firstButton = r.state.button
  r = play(r, 0, { type: 'fold' })
  r = play(r, 1, { type: 'fold' })
  assert.equal(tick(r.state, r.secret, ctx({ now: r.state.nextHandAt! - 1 })), null)
  r = tick(r.state, r.secret, ctx({ now: r.state.nextHandAt! }))!
  assert.equal(r.state.phase, 'playing')
  assert.equal(r.state.handNo, 2)
  assert.notEqual(r.state.button, firstButton)
})

test('leaving mid-hand folds, settles chips in the ledger and frees the seat', () => {
  let r = startGame(table(['A', 'B', 'C']), { deck: [], hands: {} }, ctx())
  r = play(r, 0, { type: 'raise', amount: 30 })
  r = leave(r.state, r.secret, ctx(), 0) // A leaves while B is to act
  assert.equal(r.state.seats[0]!.folded, true)
  assert.equal(r.state.seats[0]!.leaving, true)
  r = play(r, 1, { type: 'fold' }) // C wins, hand ends, A is removed
  assert.equal(r.state.seats[0], null)
  assert.equal(r.state.ledger['u-A'].cashedOut, 970)
  assert.equal(r.state.ledger['u-A'].boughtIn, 1000)
})

test('busted players can rebuy between hands; seats and duplicates are validated', () => {
  let r = startGame(table(['A', 'B']), { deck: [], hands: {} }, ctx())
  const btn = r.state.button, other = 1 - btn
  r.secret = rig(r.secret, { [btn]: ['As', 'Ad'], [other]: ['7c', '2d'] }, ['Ah', 'Kd', '9s', '4c', '3h'])
  r = play(r, btn, { type: 'raise', amount: 1000 })
  r = play(r, other, { type: 'call' })
  assert.equal(r.state.seats[other]!.stack, 0)
  const s2 = rebuy(r.state, cfg, other)
  assert.equal(s2.seats[other]!.stack, 1000)
  assert.equal(s2.ledger[s2.seats[other]!.userId].boughtIn, 2000)
  assert.throws(() => rebuy(s2, cfg, other), (e: GameError) => e.code === 'still_has_chips')
  assert.throws(() => sit(s2, cfg, other, { userId: 'x', name: 'X', avatar: null }), (e: GameError) => e.code === 'seat_taken')
  assert.throws(() => sit(s2, cfg, 4, { userId: 'u-A', name: 'A', avatar: null }), (e: GameError) => e.code === 'already_seated')
})

test('a busted player is not dealt in and the game waits for two players', () => {
  let r = startGame(table(['A', 'B']), { deck: [], hands: {} }, ctx())
  const btn = r.state.button, other = 1 - btn
  r.secret = rig(r.secret, { [btn]: ['As', 'Ad'], [other]: ['7c', '2d'] }, ['Ah', 'Kd', '9s', '4c', '3h'])
  r = play(r, btn, { type: 'raise', amount: 1000 })
  r = play(r, other, { type: 'call' })
  r = tick(r.state, r.secret, ctx({ now: r.state.nextHandAt! }))!
  assert.equal(r.state.phase, 'waiting')
  // after a rebuy the game resumes by itself
  const s = rebuy(r.state, cfg, other)
  const next = tick(s, r.secret, ctx())!
  assert.equal(next.state.phase, 'playing')
})

test('cannot act out of turn', () => {
  const r = startGame(table(['A', 'B', 'C']), { deck: [], hands: {} }, ctx())
  assert.throws(() => play(r, 2, { type: 'check' }), (e: GameError) => e.code === 'not_your_turn')
})

// ─── fuzz: random legal play never creates or destroys chips ───────────────

test('random games keep chip totals and invariants intact', () => {
  let seed = 7
  const rnd = (n: number) => { seed = (seed * 48271) % 2147483647; return seed % n }
  for (let game = 0; game < 40; game++) {
    const players = 2 + (game % 5)
    let r = startGame(table(Array.from({ length: players }, (_, k) => `P${k}`)), { deck: [], hands: {} }, ctx({ randInt: rnd }))
    const total = players * 1000
    for (let step = 0; step < 3000 && r.state.phase !== 'waiting'; step++) {
      const s = r.state
      assert.equal(totalChips(s), total, `chips conserved (game ${game}, step ${step})`)
      for (const p of s.seats) if (p) assert.ok(p.stack >= 0)
      if (s.phase === 'handOver') {
        r = tick(s, r.secret, ctx({ now: s.nextHandAt!, randInt: rnd }))!
        continue
      }
      const seat = s.toAct!
      const p = s.seats[seat]!
      const toCall = s.currentBet - p.bet
      const options: Action[] = []
      if (toCall > 0) options.push({ type: 'fold' }, { type: 'call' })
      else options.push({ type: 'check' })
      if (!p.acted && p.stack > toCall) {
        const min = Math.min(s.currentBet + s.minRaise, p.bet + p.stack)
        const max = p.bet + p.stack
        options.push({ type: 'raise', amount: min }, { type: 'raise', amount: max }, { type: 'raise', amount: min + rnd(Math.max(1, max - min)) })
      }
      r = play(r, seat, options[rnd(options.length)], ctx({ randInt: rnd }))
    }
    // ledger: everyone is still seated, so stacks must equal what was bought in
    const s = r.state
    const inPlay = s.seats.reduce((sum, p) => sum + (p ? p.stack + p.committed : 0), 0)
    const bought = Object.values(s.ledger).reduce((sum, e) => sum + e.boughtIn - e.cashedOut, 0)
    assert.equal(inPlay, bought)
  }
})

// ─── host tools, chat, hand names ──────────────────────────────────────────

test('host can kick a player mid-hand; they fold, are cashed out and cannot sit again', () => {
  let r = startGame(table(['A', 'B', 'C']), { deck: [], hands: {} }, ctx())
  r = kick(r.state, r.secret, ctx(), 2) // C is in the big blind, not to act
  assert.equal(r.state.seats[2]!.folded, true)
  r = play(r, 0, { type: 'fold' }) // B wins, hand ends, C removed
  assert.equal(r.state.seats[2], null)
  assert.equal(r.state.ledger['u-C'].cashedOut, 990)
  assert.ok(r.state.log.some(e => e.kind === 'kick' && e.name === 'C'))
  assert.throws(() => sit(r.state, cfg, 2, { userId: 'u-C', name: 'C', avatar: null }), (e: GameError) => e.code === 'kicked')
  assert.equal(totalChips(r.state) + r.state.ledger['u-C'].cashedOut, 3000)
})

test('chat keeps recent messages, trims text and rate-limits', () => {
  let s = table(['A', 'B'])
  s = addChat(s, { userId: 'u-A', name: 'A' }, '  hello   there  ', 1000)
  assert.equal(s.chat!.at(-1)!.text, 'hello there')
  assert.throws(() => addChat(s, { userId: 'u-A', name: 'A' }, 'again', 1200), (e: GameError) => e.code === 'too_fast')
  assert.throws(() => addChat(s, { userId: 'u-B', name: 'B' }, '   ', 1200), (e: GameError) => e.code === 'empty_message')
  for (let k = 0; k < 60; k++) s = addChat(s, { userId: 'u-B', name: 'B' }, `m${k}`, 2000 + k * 1000)
  assert.equal(s.chat!.length, 50)
  assert.equal(s.chat!.at(-1)!.text, 'm59')
  assert.equal(addChat(s, { userId: 'u-A', name: 'A' }, 'x'.repeat(500), 100000).chat!.at(-1)!.text.length, 200)
})

test('hand category works from two to seven cards', () => {
  assert.equal(handCategory(['As', 'Ad']), 1)
  assert.equal(handCategory(['As', 'Kd']), 0)
  assert.equal(handCategory(['As', 'Ad', 'Ah', 'Kc']), 3)
  assert.equal(handCategory(['9s', '8d', '7h', '6c', '5s']), 4)
  assert.equal(handCategory(['9s', '8d', '7h', '6c', '5s', 'Ks', '2s']), 4)
  assert.equal(handCategory(['As', 'Ks', '7s', '6s', '2s', 'Kd', 'Kh']), 5)
  assert.equal(handCategory(['As']), null)
})

// ─── tournament mode ───────────────────────────────────────────────────────

const tcfg: TableConfig = { smallBlind: 10, bigBlind: 20, startingStack: 1500, maxSeats: 6, turnSeconds: 30, mode: 'tournament', levelMinutes: 5 }
const LEVEL = 5 * 60_000

function tctx(now: number, randInt?: (n: number) => number): Ctx {
  return { ...ctx({ now }), cfg: tcfg, ...(randInt ? { randInt } : {}) }
}

function ttable(names: string[]): GameState {
  return table(names, undefined, tcfg)
}

test('blind structure starts at the configured big blind and only goes up', () => {
  const levels = blindStructure(20)
  assert.deepEqual(levels[0], { sb: 10, bb: 20 })
  assert.deepEqual(levels.slice(0, 5).map(l => l.bb), [20, 30, 40, 60, 80])
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i].bb > levels[i - 1].bb)
  for (const l of levels) assert.equal(l.sb, Math.floor(l.bb / 2))
})

test('tournament blinds rise with the level clock, and pausing stops the clock', () => {
  const T = 5_000_000
  let r = startGame(ttable(['A', 'B', 'C']), { deck: [], hands: {} }, tctx(T))
  assert.equal(r.state.blinds!.bb, 20)
  r = play(r, r.state.toAct!, { type: 'fold' }, tctx(T))
  r = play(r, r.state.toAct!, { type: 'fold' }, tctx(T))
  // pause for 10 minutes in the middle of level 1
  let s = setPaused(r.state, true, T + 60_000)
  s = setPaused(s, false, T + 60_000 + 10 * 60_000)
  r = startHand(s, r.secret, tctx(T + 10 * 60_000 + LEVEL - 1)) // only ~4:59 of play counted
  assert.equal(r.state.blinds!.bb, 20)
  r = play(r, r.state.toAct!, { type: 'fold' }, tctx(T))
  r = play(r, r.state.toAct!, { type: 'fold' }, tctx(T))
  r = startHand(r.state, r.secret, tctx(T + 10 * 60_000 + LEVEL + 1))
  assert.equal(r.state.tournament!.level, 1)
  assert.equal(r.state.blinds!.bb, 30)
  assert.ok(r.state.log.some(e => e.kind === 'level' && e.place === 2))
})

test('heads-up all-in decides the tournament: places, champion, no more hands', () => {
  let r = startGame(ttable(['A', 'B']), { deck: [], hands: {} }, tctx(1000))
  const btn = r.state.button, other = 1 - btn
  r.secret = rig(r.secret, { [btn]: ['As', 'Ad'], [other]: ['7c', '2d'] }, ['Ah', 'Kd', '9s', '4c', '3h'])
  r = play(r, btn, { type: 'raise', amount: 1500 }, tctx(1000))
  r = play(r, other, { type: 'call' }, tctx(1000))
  const t = r.state.tournament!
  assert.equal(t.finished, true)
  assert.deepEqual(t.places.map(p => [p.name, p.place]).sort(), [[r.state.seats[btn]!.name, 1], [btn === 0 ? 'B' : 'A', 2]].sort())
  assert.equal(r.state.seats[other], null, 'the loser leaves the table')
  assert.equal(r.state.started, false)
  const next = tick(r.state, r.secret, tctx(r.state.nextHandAt!))!
  assert.equal(next.state.phase, 'waiting')
  assert.throws(() => rebuy(next.state, tcfg, btn), (e: GameError) => e.code === 'no_rebuy')
})

test('two players busting in the same hand: the bigger stack finishes higher', () => {
  const s = ttable(['A', 'B', 'C'])
  s.seats[1]!.stack = 300 // B
  s.seats[2]!.stack = 600 // C
  let r = startGame(s, { deck: [], hands: {} }, tctx(1000))
  // startGame gives everyone a fresh stack, so set the short stacks after it
  r.state.seats[1]!.stack = 300 - r.state.seats[1]!.bet
  r.state.seats[2]!.stack = 600 - r.state.seats[2]!.bet
  r.secret = rig(r.secret, { 0: ['As', 'Ad'], 1: ['7c', '2d'], 2: ['8h', '3c'] }, ['Ah', 'Kd', '9s', '4c', 'Jh'])
  r = play(r, 0, { type: 'raise', amount: 1500 }, tctx(1000))
  r = play(r, 1, { type: 'call' }, tctx(1000))
  r = play(r, 2, { type: 'call' }, tctx(1000))
  const places = Object.fromEntries(r.state.tournament!.places.map(p => [p.name, p.place]))
  assert.deepEqual(places, { C: 2, B: 3, A: 1 })
  assert.equal(r.state.tournament!.finished, true)
})

test('no late seating while a tournament runs; leaving forfeits', () => {
  let r = startGame(ttable(['A', 'B', 'C']), { deck: [], hands: {} }, tctx(1000))
  assert.throws(() => sit(r.state, tcfg, 4, { userId: 'u-D', name: 'D', avatar: null }), (e: GameError) => e.code === 'tournament_running')
  r = leave(r.state, r.secret, tctx(1000), 2) // C is the big blind, folds and leaves
  r = play(r, 0, { type: 'fold' }, tctx(1000)) // B wins the blinds; hand ends; C is out
  const places = r.state.tournament!.places
  assert.equal(places.length, 1)
  assert.deepEqual([places[0].name, places[0].place], ['C', 3])
})

test('players sitting out in a tournament are dealt in and fold automatically', () => {
  let r = startGame(ttable(['A', 'B', 'C']), { deck: [], hands: {} }, tctx(1000))
  r = play(r, r.state.toAct!, { type: 'fold' }, tctx(1000))
  r = play(r, r.state.toAct!, { type: 'fold' }, tctx(1000))
  const s = setSittingOut(r.state, 0, true)
  r = startHand(s, r.secret, tctx(2000))
  assert.equal(r.state.seats[0]!.inHand, true, 'still dealt in')
  // A is first to act preflop in 3-handed only if A is UTG; either way A never holds up the table
  while (r.state.phase === 'playing' && r.state.toAct !== null) {
    assert.notEqual(r.state.toAct, 0, 'a sitting-out player is never left to act')
    const p = r.state.seats[r.state.toAct]!
    r = play(r, r.state.toAct, p.bet < r.state.currentBet ? { type: 'call' } : { type: 'check' }, tctx(2000))
  }
})

test('host can start the next tournament after one finishes', () => {
  let r = startGame(ttable(['A', 'B']), { deck: [], hands: {} }, tctx(1000))
  const btn = r.state.button, other = 1 - btn
  r.secret = rig(r.secret, { [btn]: ['As', 'Ad'], [other]: ['7c', '2d'] }, ['Ah', 'Kd', '9s', '4c', '3h'])
  r = play(r, btn, { type: 'raise', amount: 1500 }, tctx(1000))
  r = play(r, other, { type: 'call' }, tctx(1000))
  let s = sit(r.state, tcfg, other, { userId: 'u-Z', name: 'Z', avatar: null })
  r = startGame(s, r.secret, tctx(9_000_000))
  assert.equal(r.state.tournament!.finished, false)
  assert.equal(r.state.tournament!.places.length, 0)
  assert.equal(r.state.tournament!.entrants, 2)
  assert.equal(totalChips(r.state), 3000)
})

test('random tournaments always finish with unique places 1..N', () => {
  let seed = 3
  const rnd = (n: number) => { seed = (seed * 48271) % 2147483647; return seed % n }
  for (let game = 0; game < 30; game++) {
    const players = 2 + (game % 5)
    const names = Array.from({ length: players }, (_, k) => `P${k}`)
    let now = 1_000_000
    let r = startGame(ttable(names), { deck: [], hands: {} }, tctx(now, rnd))
    for (let step = 0; step < 20000 && !r.state.tournament!.finished; step++) {
      now += 20_000 // blinds keep going up, so it always ends
      const s = r.state
      const live = s.seats.reduce((sum, p) => sum + (p ? p.stack + p.committed : 0), 0)
      assert.equal(live, players * 1500, `chips conserved (game ${game})`)
      if (s.phase !== 'playing') { r = tick(s, r.secret, tctx(Math.max(now, s.nextHandAt ?? now), rnd)) ?? r; continue }
      const p = s.seats[s.toAct!]!
      const toCall = s.currentBet - p.bet
      const opts: Action[] = toCall > 0 ? [{ type: 'fold' }, { type: 'call' }, { type: 'call' }] : [{ type: 'check' }]
      if (!p.acted && p.stack > toCall) opts.push({ type: 'raise', amount: p.bet + p.stack })
      r = play(r, s.toAct!, opts[rnd(opts.length)], tctx(now, rnd))
    }
    const t = r.state.tournament!
    assert.equal(t.finished, true, `game ${game} finished`)
    assert.deepEqual(t.places.map(p => p.place).sort((a, b) => a - b), Array.from({ length: players }, (_, k) => k + 1))
  }
})
