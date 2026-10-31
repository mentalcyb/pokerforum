import { createHmac, timingSafeEqual } from 'crypto'

// A signed "way back" ticket given to the owner when entering a test account. Signed with the
// server's secret key, so it can't be forged; valid for 12 hours.
const TTL_MS = 12 * 3600_000
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export function makeReturnTicket(ownerId: string): string {
  const payload = Buffer.from(JSON.stringify({ o: ownerId, e: Date.now() + TTL_MS })).toString('base64url')
  const sig = createHmac('sha256', key()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function readReturnTicket(ticket: string): string | null {
  const [payload, sig] = String(ticket).split('.')
  if (!payload || !sig || !key()) return null
  const expected = createHmac('sha256', key()).update(payload).digest('base64url')
  const a = Buffer.from(sig), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const { o, e } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return typeof o === 'string' && typeof e === 'number' && e > Date.now() ? o : null
  } catch { return null }
}
