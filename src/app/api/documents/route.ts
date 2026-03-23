import { NextRequest, NextResponse } from 'next/server'
import { getDB, generateId } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const { searchParams } = new URL(request.url)
  const propertyId = searchParams.get('property_id')

  if (!propertyId) return NextResponse.json({ error: 'Missing property_id' }, { status: 400 })

  try {
    const results = (await db.prepare(
      `SELECT d.*, u.full_name as responsible_name
       FROM property_documents d
       LEFT JOIN users u ON d.responsible_id = u.id
       WHERE d.property_id = ?
       ORDER BY d.sort_order ASC, d.created_at ASC`
    ).bind(propertyId).all()).results as any[]

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
  const orgId = user.org_id || 'org_mg'

  try {
    await db.prepare(`
      INSERT INTO property_documents (id, org_id, property_id, document_name, document_type,
        status, observations, responsible_id, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, orgId,
      data.property_id,
      data.document_name || '',
      data.document_type || 'otro',
      data.status || 'pendiente',
      data.observations || null,
      data.responsible_id || user.id,
      data.sort_order || 0
    ).run()

    return NextResponse.json({ id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const data = (await request.json()) as any
  if (!data.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = await getDB()

  try {
    await db.prepare(`
      UPDATE property_documents SET
        document_name=?, document_type=?, status=?,
        observations=?, responsible_id=?, sort_order=?,
        updated_at=datetime('now')
      WHERE id=?
    `).bind(
      data.document_name || '',
      data.document_type || 'otro',
      data.status || 'pendiente',
      data.observations || null,
      data.responsible_id || null,
      data.sort_order || 0,
      data.id
    ).run()

    return NextResponse.json({ success: true })
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
    await db.prepare('DELETE FROM property_documents WHERE id = ?').bind(id).run()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
