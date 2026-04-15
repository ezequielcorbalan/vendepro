import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB, generateId } from '@/lib/db'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  const blocks = (await db.prepare(
    'SELECT * FROM tasacion_template_blocks WHERE org_id = ? ORDER BY sort_order'
  ).bind(orgId).all()).results as any[]

  return NextResponse.json(blocks)
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'admin' && user.role !== 'owner'))
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const body = (await request.json()) as any
  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  // Get next sort_order
  const last = (await db.prepare(
    'SELECT MAX(sort_order) as max_order FROM tasacion_template_blocks WHERE org_id = ?'
  ).bind(orgId).first()) as any
  const nextOrder = (last?.max_order || 0) + 1

  const id = generateId()
  await db.prepare(
    `INSERT INTO tasacion_template_blocks (id, org_id, block_type, title, description, icon, number_label, video_url, image_url, sort_order, enabled, section)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, orgId,
    body.block_type || 'service',
    body.title || 'Nuevo bloque',
    body.description || '',
    body.icon || null,
    body.number_label || null,
    body.video_url || null,
    body.image_url || null,
    body.sort_order ?? nextOrder,
    body.enabled ?? 1,
    body.section || 'commercial'
  ).run()

  return NextResponse.json({ id, sort_order: body.sort_order ?? nextOrder })
}
