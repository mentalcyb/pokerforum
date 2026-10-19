import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'

/** True if the request carries the Bearer token of a signed-in admin. */
export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token) return false
  const admin = createAdminClient()
  const { data: { user } } = await admin.auth.getUser(token)
  if (!user) return false
  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).single()
  return !!profile?.is_admin
}
