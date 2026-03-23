import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  try {
    const agents = (await db.prepare(
      `SELECT id, full_name, email, phone, role FROM users WHERE org_id = ? ORDER BY full_name ASC`
    ).bind(orgId).all()).results
    return NextResponse.json(agents)
  } catch {
    return NextResponse.json([])
  }
}
