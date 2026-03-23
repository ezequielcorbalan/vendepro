import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// Search leads, contacts, properties for entity linking (calendar, activities)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q') || ''
  const type = searchParams.get('type') // lead, contact, property

  if (q.length < 2) return NextResponse.json([])

  try {
    const results: any[] = []
    const like = `%${q}%`

    if (!type || type === 'lead') {
      const leads = (await db.prepare(
        `SELECT id, full_name as name, phone, 'lead' as entity_type FROM leads WHERE org_id = ? AND (full_name LIKE ? OR phone LIKE ?) LIMIT 5`
      ).bind(orgId, like, like).all()).results as any[]
      results.push(...leads)
    }

    if (!type || type === 'contact') {
      const contacts = (await db.prepare(
        `SELECT id, full_name as name, phone, 'contact' as entity_type FROM contacts WHERE org_id = ? AND (full_name LIKE ? OR phone LIKE ?) LIMIT 5`
      ).bind(orgId, like, like).all()).results as any[]
      results.push(...contacts)
    }

    if (!type || type === 'property') {
      const properties = (await db.prepare(
        `SELECT id, address as name, NULL as phone, 'property' as entity_type FROM properties WHERE org_id = ? AND address LIKE ? LIMIT 5`
      ).bind(orgId, like).all()).results as any[]
      results.push(...properties)
    }

    return NextResponse.json(results)
  } catch {
    return NextResponse.json([])
  }
}
