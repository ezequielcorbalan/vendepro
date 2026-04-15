import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB } from '@/lib/db'

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'admin' && user.role !== 'owner'))
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const { id } = await params
  const body = (await request.json()) as any
  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  // Verify ownership
  const block = await db.prepare(
    'SELECT id FROM tasacion_template_blocks WHERE id = ? AND org_id = ?'
  ).bind(id, orgId).first()
  if (!block) return NextResponse.json({ error: 'Bloque no encontrado' }, { status: 404 })

  const fields: string[] = []
  const values: any[] = []

  for (const key of ['title', 'description', 'icon', 'number_label', 'video_url', 'image_url', 'block_type', 'section', 'enabled', 'sort_order']) {
    if (body[key] !== undefined) {
      fields.push(`${key} = ?`)
      values.push(body[key])
    }
  }

  if (fields.length === 0) return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })

  fields.push("updated_at = datetime('now')")
  values.push(id, orgId)

  await db.prepare(
    `UPDATE tasacion_template_blocks SET ${fields.join(', ')} WHERE id = ? AND org_id = ?`
  ).bind(...values).run()

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'admin' && user.role !== 'owner'))
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const { id } = await params
  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  await db.prepare(
    'DELETE FROM tasacion_template_blocks WHERE id = ? AND org_id = ?'
  ).bind(id, orgId).run()

  return NextResponse.json({ success: true })
}
