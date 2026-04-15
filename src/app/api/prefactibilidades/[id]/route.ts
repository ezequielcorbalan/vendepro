import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB } from '@/lib/db'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { id } = await params
  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  const result = await db.prepare(
    'SELECT * FROM prefactibilidades WHERE id = ? AND org_id = ?'
  ).bind(id, orgId).first()

  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(result)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { id } = await params
  const body = (await request.json()) as any
  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  const jsonFields = ['lot_photos', 'units_mix', 'amenities', 'project_renders', 'comparables', 'timeline']
  const fields: string[] = []
  const values: any[] = []

  for (const [key, val] of Object.entries(body)) {
    if (val === undefined) continue
    fields.push(`${key} = ?`)
    values.push(jsonFields.includes(key) ? JSON.stringify(val) : val)
  }

  if (fields.length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  fields.push("updated_at = datetime('now')")
  values.push(id, orgId)

  await db.prepare(
    `UPDATE prefactibilidades SET ${fields.join(', ')} WHERE id = ? AND org_id = ?`
  ).bind(...values).run()

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { id } = await params
  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  await db.prepare('DELETE FROM prefactibilidades WHERE id = ? AND org_id = ?').bind(id, orgId).run()
  return NextResponse.json({ success: true })
}
