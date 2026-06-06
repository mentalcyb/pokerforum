import { NextRequest, NextResponse } from 'next/server'

type Action = { street: string; player: string; action: string; amount?: string }

function matchAllBrackets(line: string): string[] {
  const re = /\[(.+?)\]/g
  const results: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) results.push(m[1])
  return results
}

function parseHandHistory(text: string) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)

  let heroCards = ''
  let heroName = 'Hero'
  let board: string[] = []
  let gameType = "Hold'em"
  let stakes = ''
  const stacks: Record<string, string> = {}
  const actions: Action[] = []
  let currentStreet = 'preflop'
  let potSize = ''

  for (const line of lines) {
    if (line.includes('Omaha')) gameType = 'Omaha'

    const stakesMatch = line.match(/\(?\$?([\d.]+)\/([\d.]+)/)
    if (stakesMatch && !stakes) stakes = `$${stakesMatch[1]}/$${stakesMatch[2]}`

    // Seat stacks (PokerStars & GGPoker)
    const seatMatch = line.match(/Seat \d+: (.+?) \(\$?([\d.]+)/)
    if (seatMatch) stacks[seatMatch[1]] = seatMatch[2]

    // Hole cards
    const psDealt = line.match(/Dealt to (.+?) \[(.+?)\]/)
    if (psDealt) { heroName = psDealt[1]; heroCards = psDealt[2] }
    const ggDealt = line.match(/^(.+?) \[(.+?)\]: (?:is dealt|dealt)/)
    if (ggDealt) { heroName = ggDealt[1]; heroCards = ggDealt[2] }

    // Street markers & board
    if (line.includes('*** HOLE CARDS ***')) { currentStreet = 'preflop'; continue }
    if (line.includes('*** FLOP ***')) {
      currentStreet = 'flop'
      const m = line.match(/\[(.+?)\]/)
      if (m) board = m[1].split(' ')
      continue
    }
    if (line.includes('*** TURN ***')) {
      currentStreet = 'turn'
      const all = matchAllBrackets(line)
      if (all.length >= 2) board = [...all[0].split(' '), all[1]]
      continue
    }
    if (line.includes('*** RIVER ***')) {
      currentStreet = 'river'
      const all = matchAllBrackets(line)
      if (all.length >= 2) board = [...all[0].split(' '), all[1]]
      continue
    }

    // GGPoker streets
    const ggFlop = line.match(/^Flop\(Pot:.*?\):\s*\[(.+?)\]/i)
    if (ggFlop) { currentStreet = 'flop'; board = ggFlop[1].split(' '); continue }
    const ggTurn = line.match(/^Turn\(Pot:.*?\):\s*\[(.+?)\]\s*\[(.+?)\]/i)
    if (ggTurn) { currentStreet = 'turn'; board = [...ggTurn[1].split(' '), ggTurn[2]]; continue }
    const ggRiver = line.match(/^River\(Pot:.*?\):\s*\[(.+?)\]\s*\[(.+?)\]/i)
    if (ggRiver) { currentStreet = 'river'; board = [...ggRiver[1].split(' '), ggRiver[2]]; continue }

    // Actions
    const fold = line.match(/^(.+?): folds/)
    const call = line.match(/^(.+?): calls \$?([\d.]+)/)
    const raise = line.match(/^(.+?): raises \$?[\d.]+ to \$?([\d.]+)/)
    const bet = line.match(/^(.+?): bets \$?([\d.]+)/)
    const check = line.match(/^(.+?): checks/)
    const allin = line.match(/^(.+?): (?:is )?all.in(?: for \$?([\d.]+))?/i)

    if (fold) actions.push({ street: currentStreet, player: fold[1], action: 'folds' })
    else if (call) actions.push({ street: currentStreet, player: call[1], action: 'calls', amount: call[2] })
    else if (raise) actions.push({ street: currentStreet, player: raise[1], action: 'raises to', amount: raise[2] })
    else if (bet) actions.push({ street: currentStreet, player: bet[1], action: 'bets', amount: bet[2] })
    else if (check) actions.push({ street: currentStreet, player: check[1], action: 'checks' })
    else if (allin) actions.push({ street: currentStreet, player: allin[1], action: 'all-in', amount: allin[2] })

    // Pot summary
    const pot = line.match(/Total pot \$?([\d.]+)/)
    if (pot) potSize = pot[1]
  }

  return { heroName, heroCards, board, gameType, stakes, stacks, actions, potSize }
}

function formatActions(actions: Action[], street: string) {
  return actions
    .filter(a => a.street === street)
    .map(a => `  ${a.player}: ${a.action}${a.amount ? ` $${a.amount}` : ''}`)
    .join('\n')
}

export async function POST(req: NextRequest) {
  try {
    console.log('[analyze-hand] OPENROUTER_API_KEY present:', !!process.env.OPENROUTER_API_KEY)
    console.log('[analyze-hand] OPENROUTER_API_KEY length:', process.env.OPENROUTER_API_KEY?.length ?? 0)

    const { handHistory, lang } = await req.json()
    if (!handHistory?.trim()) {
      return NextResponse.json({ error: 'No hand history provided' }, { status: 400 })
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'AI analysis is not configured. OPENROUTER_API_KEY is missing on the server.' }, { status: 503 })
    }

    const langInstruction = lang === 'ka'
      ? 'You MUST respond entirely in Georgian language (ქართული ენა). Every single word of your response must be in Georgian. Do not use English.'
      : ''

    const p = parseHandHistory(handHistory)

    const streets = ['preflop', 'flop', 'turn', 'river']
    const actionSummary = streets
      .map(s => {
        const acts = formatActions(p.actions, s)
        return acts ? `${s.toUpperCase()}:\n${acts}` : null
      })
      .filter(Boolean)
      .join('\n')

    const stackSummary = Object.entries(p.stacks)
      .map(([player, stack]) => `${player}: $${stack}`)
      .join(', ')

    const prompt = `${langInstruction ? langInstruction + '\n\n' : ''}You are a friendly poker coach analyzing a hand for a community forum. Be insightful but conversational — frame this as a discussion starter, not a GTO lecture.

HAND DETAILS:
- Game: ${p.gameType}${p.stakes ? ` (${p.stakes})` : ''}
- Hero: ${p.heroName} holding ${p.heroCards || '(unknown)'}
- Board: ${p.board.join(' ') || '(none)'}
- Final pot: ${p.potSize ? `$${p.potSize}` : 'unknown'}
- Stacks: ${stackSummary || 'unknown'}

ACTIONS:
${actionSummary || '(no actions parsed)'}

FULL HAND:
${handHistory}

Respond with ONLY valid JSON (no markdown, no code blocks) matching this exact schema:
{
  "summary": "1-2 sentence overview of the hand and its key decision point",
  "preflop": { "assessment": "concise evaluation", "status": "ok", "note": "coaching note" },
  "flop": { "assessment": "concise evaluation", "status": "ok", "note": "coaching note" },
  "turn": { "assessment": "concise evaluation", "status": "warning", "note": "coaching note" },
  "river": { "assessment": "concise evaluation", "status": "error", "note": "coaching note" },
  "keyMistake": "the most important spot to improve, or null if played well",
  "discussion": "2-3 sentences inviting community debate about the most interesting decision"
}

Status must be "ok", "warning", or "error". Include only streets that appear in the hand. Set missing streets to null.`

    console.log('[analyze-hand] lang:', lang)
    console.log('[analyze-hand] Authorization header will be: Bearer <key present:', !!process.env.OPENROUTER_API_KEY, '>')
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemma-4-31b-it:free',
        messages: [
          ...(langInstruction ? [{ role: 'system', content: langInstruction }] : []),
          { role: 'user', content: prompt },
        ],
      }),
    })
    const resText = await res.text()
    console.log('[analyze-hand] OpenRouter status:', res.status)
    console.log('[analyze-hand] OpenRouter body:', resText)

    if (!res.ok) {
      return NextResponse.json({ error: `OpenRouter ${res.status}: ${resText}` }, { status: 502 })
    }
    const json = JSON.parse(resText)
    const text: string = json.choices?.[0]?.message?.content ?? ''

    // Extract JSON even if wrapped in markdown code fences
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
    }

    const analysis = JSON.parse(jsonMatch[0])
    return NextResponse.json({ analysis, parsed: p })
  } catch (err) {
    console.error('[analyze-hand]', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
