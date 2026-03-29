import { getCurrentUser } from '@/lib/auth'
import { getDB, generateId } from '@/lib/db'
import { slugify } from '@/lib/utils'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'
  const { searchParams } = new URL(request.url)
  const stage = searchParams.get('commercial_stage')
  const agentId = searchParams.get('agent_id')

  try {
    let sql = `
      SELECT p.*, u.full_name as agent_name
      FROM properties p
      LEFT JOIN users u ON p.agent_id = u.id
      WHERE p.org_id = ?
    `
    const binds: any[] = [orgId]

    if (stage) { sql += ' AND p.commercial_stage = ?'; binds.push(stage) }
    if (agentId) { sql += ' AND p.agent_id = ?'; binds.push(agentId) }

    // Non-admin sees only own properties
    const isAdmin = user.role === 'admin' || user.role === 'owner'
    if (!isAdmin) { sql += ' AND p.agent_id = ?'; binds.push(user.id) }

    sql += ' ORDER BY p.updated_at DESC'
    const results = (await db.prepare(sql).bind(...binds).all()).results
    return NextResponse.json(results)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = (await request.json()) as any
  const db = await getDB()
  const orgId = user.org_id || 'org_mg'
  const id = generateId()
  const slug = slugify(`${body.address}-${body.neighborhood}`)

  try {
    await db.prepare(`
      INSERT INTO properties (id, org_id, address, neighborhood, city, property_type, rooms, size_m2,
        asking_price, currency, owner_name, owner_phone, owner_email, public_slug, agent_id,
        commercial_stage, lead_id, appraisal_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, orgId, body.address, body.neighborhood, body.city || 'Buenos Aires',
      body.property_type || 'departamento',
      body.rooms ? parseInt(body.rooms) : null,
      body.size_m2 ? parseFloat(body.size_m2) : null,
      body.asking_price ? parseFloat(body.asking_price) : null,
      body.currency || 'USD',
      body.owner_name, body.owner_phone || null, body.owner_email || null,
      slug, body.agent_id || user.id,
      body.commercial_stage || 'captada',
      body.lead_id || null, body.appraisal_id || null
    ).run()

    return NextResponse.json({ id, slug })
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Ya existe una propiedad con esa dirección' }, { status: 400 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const data = (await request.json()) as any
  if (!data.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  try {
    // Verify ownership
    const current = await db.prepare('SELECT * FROM properties WHERE id = ? AND org_id = ?').bind(data.id, orgId).first() as any
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Quick partial updates (stage, authorization, etc.)
    const keys = Object.keys(data).filter(k => k !== 'id')
    if (keys.length <= 3 && keys.every(k => ['commercial_stage', 'authorization_start', 'authorization_days', 'status'].includes(k))) {
      const sets: string[] = ['updated_at=datetime(\'now\')']
      const binds: any[] = []
      for (const k of keys) {
        sets.push(`${k}=?`)
        binds.push(data[k])
      }
      binds.push(data.id, orgId)
      await db.prepare(`UPDATE properties SET ${sets.join(',')} WHERE id=? AND org_id=?`).bind(...binds).run()
      return NextResponse.json({ success: true })
    }

    // Full update
    const m = (key: string) => data[key] !== undefined ? data[key] : current[key]
    await db.prepare(`
      UPDATE properties SET
        address=?, neighborhood=?, city=?, property_type=?, rooms=?, size_m2=?,
        asking_price=?, currency=?, owner_name=?, owner_phone=?, owner_email=?,
        agent_id=?, commercial_stage=?, status=?,
        authorization_start=?, authorization_days=?,
        updated_at=datetime('now')
      WHERE id=? AND org_id=?
    `).bind(
      m('address'), m('neighborhood'), m('city'), m('property_type'),
      m('rooms'), m('size_m2'), m('asking_price'), m('currency'),
      m('owner_name'), m('owner_phone'), m('owner_email'),
      m('agent_id'), m('commercial_stage'), m('status'),
      m('authorization_start'), m('authorization_days'),
      data.id, orgId
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
  const orgId = user.org_id || 'org_mg'
  const isAdmin = user.role === 'admin' || user.role === 'owner'
  if (!isAdmin) return NextResponse.json({ error: 'No permission' }, { status: 403 })

  try {
    await db.prepare('DELETE FROM properties WHERE id = ? AND org_id = ?').bind(id, orgId).run()
    // Also delete related reports
    try { await db.prepare('DELETE FROM reports WHERE property_id = ?').bind(id).run() } catch {}
    try { await db.prepare('DELETE FROM report_photos WHERE report_id IN (SELECT id FROM reports WHERE property_id = ?)').bind(id).run() } catch {}
    return NextResponse.json({ deleted: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
