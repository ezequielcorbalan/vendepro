import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// GET /api/audit?entity_type=lead&entity_id=xxx&limit=50&offset=0
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const isAdmin = user.role === 'admin' || user.role === 'owner'
  if (!isAdmin) return NextResponse.json({ error: 'Solo admin' }, { status: 403 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'
  const { searchParams } = new URL(request.url)
  const entityType = searchParams.get('entity_type')
  const entityId = searchParams.get('entity_id')
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    let query = `
      SELECT sh.*, u.full_name as changed_by_name,
        CASE sh.entity_type
          WHEN 'lead' THEN (SELECT full_name FROM leads WHERE id = sh.entity_id)
          WHEN 'property' THEN (SELECT address FROM properties WHERE id = sh.entity_id)
          ELSE sh.entity_id
        END as entity_name
      FROM stage_history sh
      LEFT JOIN users u ON sh.changed_by = u.id
      WHERE sh.org_id = ?
    `
    const binds: any[] = [orgId]

    if (entityType) { query += ' AND sh.entity_type = ?'; binds.push(entityType) }
    if (entityId) { query += ' AND sh.entity_id = ?'; binds.push(entityId) }

    query += ' ORDER BY sh.created_at DESC LIMIT ? OFFSET ?'
    binds.push(limit, offset)

    const results = (await db.prepare(query).bind(...binds).all()).results as any[]

    // Count total
    let countQuery = 'SELECT COUNT(*) as total FROM stage_history WHERE org_id = ?'
    const countBinds: any[] = [orgId]
    if (entityType) { countQuery += ' AND entity_type = ?'; countBinds.push(entityType) }
    if (entityId) { countQuery += ' AND entity_id = ?'; countBinds.push(entityId) }
    const total = ((await db.prepare(countQuery).bind(...countBinds).first()) as any)?.total || 0

    return NextResponse.json({ results, total, limit, offset })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
