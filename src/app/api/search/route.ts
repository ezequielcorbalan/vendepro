import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// GET /api/search?q=term — cross-entity search
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'
  const q = new URL(request.url).searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ leads: [], contacts: [], properties: [] })

  const like = `%${q}%`

  try {
    const [leads, contacts, properties] = await Promise.all([
      db.prepare(`
        SELECT id, full_name, phone, stage, operation, neighborhood
        FROM leads WHERE org_id = ? AND (full_name LIKE ? OR phone LIKE ? OR neighborhood LIKE ? OR address LIKE ?)
        ORDER BY updated_at DESC LIMIT 8
      `).bind(orgId, like, like, like, like).all().then(r => r.results),
      db.prepare(`
        SELECT id, full_name, phone, contact_type
        FROM contacts WHERE org_id = ? AND (full_name LIKE ? OR phone LIKE ? OR email LIKE ?)
        ORDER BY updated_at DESC LIMIT 8
      `).bind(orgId, like, like, like).all().then(r => r.results),
      db.prepare(`
        SELECT id, address, neighborhood, owner_name, property_type, commercial_stage
        FROM properties WHERE org_id = ? AND (address LIKE ? OR neighborhood LIKE ? OR owner_name LIKE ?)
        ORDER BY updated_at DESC LIMIT 8
      `).bind(orgId, like, like, like).all().then(r => r.results),
    ])

    return NextResponse.json({ leads, contacts, properties })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
