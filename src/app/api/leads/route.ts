import { NextRequest, NextResponse } from 'next/server'
import { getDB, generateId } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

async function logStageChange(db: any, orgId: string, entityId: string, fromStage: string | null, toStage: string, changedBy: string, notes?: string) {
  const id = generateId()
  await db.prepare(
    `INSERT INTO stage_history (id, org_id, entity_type, entity_id, from_stage, to_stage, changed_by, notes)
     VALUES (?, ?, 'lead', ?, ?, ?, ?, ?)`
  ).bind(id, orgId, entityId, fromStage, toStage, changedBy, notes || null).run()
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const isAdmin = user.role === 'admin' || user.role === 'owner'
  const { searchParams } = new URL(request.url)
  const stage = searchParams.get('stage')
  const leadId = searchParams.get('id')

  try {
    // Single lead detail
    if (leadId) {
      const lead = await db.prepare(
        `SELECT l.*, u.full_name as assigned_name FROM leads l LEFT JOIN users u ON l.assigned_to = u.id WHERE l.id = ?`
      ).bind(leadId).first()
      if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      // Get activities for this lead
      const activities = (await db.prepare(
        `SELECT a.*, u.full_name as agent_name FROM activities a LEFT JOIN users u ON a.agent_id = u.id WHERE a.lead_id = ? ORDER BY a.created_at DESC`
      ).bind(leadId).all()).results

      // Get stage history
      const history = (await db.prepare(
        `SELECT sh.*, u.full_name as changed_by_name FROM stage_history sh LEFT JOIN users u ON sh.changed_by = u.id WHERE sh.entity_type = 'lead' AND sh.entity_id = ? ORDER BY sh.created_at DESC`
      ).bind(leadId).all()).results

      // Get linked appraisal
      let linkedAppraisal = null
      try {
        linkedAppraisal = await db.prepare(
          `SELECT id, property_address, neighborhood, status, created_at FROM appraisals WHERE lead_id = ? LIMIT 1`
        ).bind(leadId).first()
      } catch { /* column may not exist */ }

      return NextResponse.json({ lead, activities, history, linkedAppraisal })
    }

    let query = isAdmin
      ? `SELECT l.*, u.full_name as assigned_name FROM leads l LEFT JOIN users u ON l.assigned_to = u.id WHERE l.org_id = ?`
      : `SELECT l.*, u.full_name as assigned_name FROM leads l LEFT JOIN users u ON l.assigned_to = u.id WHERE l.org_id = ? AND (l.assigned_to = ? OR l.assigned_to IS NULL)`

    const binds: any[] = isAdmin ? [user.org_id || 'org_mg'] : [user.org_id || 'org_mg', user.id]

    if (stage) {
      query += ' AND l.stage = ?'
      binds.push(stage)
    }

    query += ' ORDER BY l.created_at DESC'

    const results = (await db.prepare(query).bind(...binds).all()).results
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
    // Use basic columns that definitely exist, then update new fields separately
    await db.prepare(`
      INSERT INTO leads (id, org_id, full_name, phone, email, source, source_detail,
        property_address, neighborhood, property_type, operation, stage, assigned_to,
        notes, estimated_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, orgId,
      data.full_name, data.phone || null, data.email || null,
      data.source || 'manual', data.source_detail || null,
      data.property_address || null, data.neighborhood || null,
      data.property_type || null, data.operation || 'venta',
      data.stage || 'nuevo', data.assigned_to || user.id,
      data.notes || null, data.estimated_value || null
    ).run()

    // Update extra fields if provided (columns may or may not exist)
    try {
      await db.prepare(`
        UPDATE leads SET budget=?, timing=?, personas_trabajo=?, mascotas=?,
          next_step=?, next_step_date=?
        WHERE id=?
      `).bind(
        data.budget || null, data.timing || null,
        data.personas_trabajo || null, data.mascotas || null,
        data.next_step || null, data.next_step_date || null, id
      ).run()
    } catch { /* columns may not exist yet */ }

    // Log initial stage
    try {
      await logStageChange(db, orgId, id, null, data.stage || 'nuevo', user.id)
    } catch { /* stage_history table may not exist */ }

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
  const orgId = user.org_id || 'org_mg'

  try {
    // Get current lead for stage history + partial update
    const current = await db.prepare('SELECT * FROM leads WHERE id = ?').bind(data.id).first() as any
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const oldStage = current.stage

    // If only stage is being changed (quick advance from list)
    if (data.stage && Object.keys(data).length <= 3) {
      let firstContactSql = ''
      const binds: any[] = [data.stage]
      if (oldStage === 'nuevo' && data.stage === 'contactado') {
        firstContactSql = ', first_contact_at=?'
        binds.push(new Date().toISOString())
      }
      binds.push(data.id)
      await db.prepare(`UPDATE leads SET stage=?, updated_at=datetime('now')${firstContactSql} WHERE id=?`).bind(...binds).run()
    } else {
      // Full update — merge with current values so we don't null out fields
      const m = (key: string) => data[key] !== undefined ? data[key] : current[key]
      let firstContactAt = null
      if (oldStage === 'nuevo' && data.stage === 'contactado') {
        firstContactAt = new Date().toISOString()
      }

      await db.prepare(`
        UPDATE leads SET full_name=?, phone=?, email=?, source=?, source_detail=?,
          property_address=?, neighborhood=?, property_type=?, operation=?, stage=?,
          assigned_to=?, notes=?, estimated_value=?, budget=?, timing=?,
          personas_trabajo=?, mascotas=?, next_step=?, next_step_date=?,
          lost_reason=?,
          first_contact_at=COALESCE(?, first_contact_at),
          updated_at=datetime('now')
        WHERE id=?
      `).bind(
        m('full_name'), m('phone'), m('email'),
        m('source'), m('source_detail'),
        m('property_address'), m('neighborhood'),
        m('property_type'), m('operation'),
        data.stage || current.stage, m('assigned_to'),
        m('notes'), m('estimated_value'),
        m('budget'), m('timing'),
        m('personas_trabajo'), m('mascotas'),
        m('next_step'), m('next_step_date'),
        m('lost_reason'),
        firstContactAt,
        data.id
      ).run()
    }

    // Log stage change if different
    if (oldStage && data.stage && oldStage !== data.stage) {
      await logStageChange(db, orgId, data.id, oldStage, data.stage, user.id, data.stage_notes)
    }

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
    const orgId = user.org_id || 'org_mg'
    // Verify ownership before delete
    const lead = await db.prepare('SELECT id FROM leads WHERE id = ? AND org_id = ?').bind(id, orgId).first()
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await db.prepare('DELETE FROM stage_history WHERE entity_type = ? AND entity_id = ?').bind('lead', id).run()
    await db.prepare('DELETE FROM activities WHERE lead_id = ?').bind(id).run()
    await db.prepare('DELETE FROM leads WHERE id = ? AND org_id = ?').bind(id, orgId).run()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
