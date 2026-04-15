import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB, generateId } from '@/lib/db'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  try {
    const tags = (await db.prepare(
      'SELECT * FROM tags WHERE org_id = ? ORDER BY is_default DESC, name'
    ).bind(orgId).all()).results as any[]
    return NextResponse.json(tags)
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const body = (await request.json()) as any
  const db = await getDB()
  const orgId = user.org_id || 'org_mg'
  const id = generateId()

  await db.prepare(
    'INSERT INTO tags (id, org_id, name, color, is_default) VALUES (?, ?, ?, ?, 0)'
  ).bind(id, orgId, body.name, body.color || '#6b7280').run()

  return NextResponse.json({ id })
}
