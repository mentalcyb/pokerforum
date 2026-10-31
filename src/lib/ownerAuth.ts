import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

/**
 * The site owner(s): e-mail addresses in the OWNER_EMAIL environment variable (comma-separated).
 * Kept outside the database on purpose, so no account can make itself an owner.
 */
export async function ownerFromRequest(req: NextRequest): Promise<{ id: string; email: string } | null> {
  const owners = (process.env.OWNER_EMAIL ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  if (!owners.length) return null
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data: { user } } = await createAdminClient().auth.getUser(token)
  const email = user?.email?.toLowerCase()
  return user && email && owners.includes(email) ? { id: user.id, email } : null
}
