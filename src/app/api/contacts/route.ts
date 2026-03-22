import { NextRequest, NextResponse } from 'next/server'
import { getDB, generateId } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('q') || ''
  const type = searchParams.get('type') || ''

  try {
    let query = 'SELECT * FROM contacts WHERE org_id = ?'
    const binds: any[] = [user.org_id || 'org_mg']

    if (search) {
      query += ' AND (full_name LIKE ? OR phone LIKE ? OR email LIKE ?)'
      binds.push(`%${search}%`, `%${search}%`, `%${search}%`)
    }
    if (type) {
      query += ' AND contact_type = ?'
      binds.push(type)
    }

    query += ' ORDER BY created_at DESC LIMIT 100'

    const stmt = db.prepare(query)
    const results = (await stmt.bind(...binds).all()).results
    return NextResponse.json(results)
  } catch {
    return NextResponse.json([])
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const data = (await request.json()) as any
  const db = await getDB()
  const id = generateId()

  try {
    await db.prepare(`
      INSERT INTO contacts (id, org_id, full_name, phone, email, contact_type, neighborhood, notes, source, agent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, user.org_id || 'org_mg',
      data.full_name, data.phone || null, data.email || null,
      data.contact_type || 'vendedor', data.neighborhood || null,
      data.notes || null, data.source || 'manual', user.id
    ).run()

    return NextResponse.json({ id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = await getDB()
  try {
    await db.prepare('DELETE FROM contacts WHERE id = ?').bind(id).run()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
