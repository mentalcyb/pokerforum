import { NextRequest, NextResponse } from 'next/server'
import { ownerFromRequest } from '@/lib/ownerAuth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return NextResponse.json({ owner: !!(await ownerFromRequest(req)) })
}
