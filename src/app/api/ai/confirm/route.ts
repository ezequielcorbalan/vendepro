import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB, generateId } from '@/lib/db'
import { resolveRelativeDate } from '@/lib/ai-crm'

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const body = (await request.json()) as any
  const { intents } = body

  if (!Array.isArray(intents) || intents.length === 0) {
    return NextResponse.json({ error: 'No intents to confirm' }, { status: 400 })
  }

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'
  const created: Record<string, string[]> = { leads: [], activities: [], appraisals: [], events: [] }
  const errors: string[] = []

  for (const intent of intents) {
    try {
      const d = intent.data || {}

      switch (intent.action) {
        case 'create_lead': {
          const id = generateId()
          await db.prepare(`
            INSERT INTO leads (id, org_id, full_name, phone, email, operation, property_type, rooms, neighborhood, property_address, estimated_value, source, notes, next_step, next_step_date, stage, assigned_to, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'nuevo', ?, datetime('now'), datetime('now'))
          `).bind(
            id, orgId,
            d.full_name || 'Sin nombre',
            d.phone || null, d.email || null,
            d.operation || 'venta',
            d.property_type || null,
            d.rooms || null,
            d.neighborhood || null,
            d.address || d.property_address || null,
            d.estimated_value || null,
            d.source || 'ia_chat',
            d.notes || null,
            d.next_step || null,
            resolveRelativeDate(d.next_step_date),
            user.id
          ).run()
          created.leads.push(id)
          break
        }

        case 'update_lead': {
          const leadId = intent.lead_id || intent.suggested_lead_id
          if (!leadId) { errors.push('update_lead: no lead_id'); break }
          const fields: string[] = []
          const vals: any[] = []
          for (const [key, val] of Object.entries(d)) {
            if (val !== null && val !== undefined && key !== 'lead_identifier') {
              fields.push(`${key} = ?`)
              vals.push(val)
            }
          }
          if (fields.length > 0) {
            fields.push("updated_at = datetime('now')")
            vals.push(leadId, orgId)
            await db.prepare(`UPDATE leads SET ${fields.join(', ')} WHERE id = ? AND org_id = ?`).bind(...vals).run()
          }
          created.leads.push(leadId)
          break
        }

        case 'create_activity': {
          const id = generateId()
          // Try to find linked lead
          let leadId = intent.lead_id || null
          if (!leadId && d.lead_name) {
            const match = (await db.prepare(
              "SELECT id FROM leads WHERE org_id = ? AND LOWER(full_name) LIKE ? LIMIT 1"
            ).bind(orgId, `%${d.lead_name.toLowerCase()}%`).first()) as any
            if (match) leadId = match.id
          }
          await db.prepare(`
            INSERT INTO activities (id, org_id, agent_id, activity_type, description, result, lead_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `).bind(
            id, orgId, user.id,
            d.activity_type || 'seguimiento',
            d.description || d.note_text || 'Actividad registrada vía IA',
            d.result || null,
            leadId
          ).run()
          created.activities.push(id)
          break
        }

        case 'create_appraisal': {
          const id = generateId()
          const slug = (d.address || 'tasacion').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + id.slice(0, 6)
          await db.prepare(`
            INSERT INTO appraisals (id, org_id, agent_id, address, neighborhood, property_type, rooms, covered_area, total_area, contact_name, contact_phone, contact_email, estimated_value, notes, public_slug, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrador', datetime('now'), datetime('now'))
          `).bind(
            id, orgId, user.id,
            d.address || '',
            d.neighborhood || '',
            d.property_type || 'departamento',
            d.rooms || null,
            d.covered_area || null,
            d.total_area || null,
            d.contact_name || null,
            d.contact_phone || null,
            d.contact_email || null,
            d.estimated_value || null,
            d.notes || null,
            slug
          ).run()
          created.appraisals.push(id)
          break
        }

        case 'schedule_followup': {
          const id = generateId()
          const startDate = resolveRelativeDate(d.start_date) || new Date(Date.now() - 3 * 3600000 + 86400000).toISOString().split('T')[0]
          const startTime = d.start_time || '10:00'
          const startAt = `${startDate}T${startTime}:00`

          // Find linked lead
          let leadId = intent.lead_id || null
          if (!leadId && d.lead_name) {
            const match = (await db.prepare(
              "SELECT id FROM leads WHERE org_id = ? AND LOWER(full_name) LIKE ? LIMIT 1"
            ).bind(orgId, `%${d.lead_name.toLowerCase()}%`).first()) as any
            if (match) leadId = match.id
          }

          await db.prepare(`
            INSERT INTO calendar_events (id, org_id, agent_id, title, event_type, start_at, description, lead_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
          `).bind(
            id, orgId, user.id,
            d.title || `Seguimiento${d.lead_name ? ' - ' + d.lead_name : ''}`,
            d.event_type || 'seguimiento',
            startAt,
            d.description || null,
            leadId
          ).run()
          created.events.push(id)
          break
        }

        case 'append_note': {
          const leadId = intent.lead_id || intent.suggested_lead_id
          if (!leadId) { errors.push('append_note: no lead_id'); break }
          const existing = (await db.prepare('SELECT notes FROM leads WHERE id = ? AND org_id = ?').bind(leadId, orgId).first()) as any
          const currentNotes = existing?.notes || ''
          const timestamp = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 16).replace('T', ' ')
          const newNotes = currentNotes
            ? `${currentNotes}\n[${timestamp} · IA] ${d.note_text || d.notes || ''}`
            : `[${timestamp} · IA] ${d.note_text || d.notes || ''}`
          await db.prepare("UPDATE leads SET notes = ?, updated_at = datetime('now') WHERE id = ? AND org_id = ?").bind(newNotes, leadId, orgId).run()
          created.leads.push(leadId)
          break
        }

        default:
          errors.push(`Unknown action: ${intent.action}`)
      }
    } catch (err: any) {
      errors.push(`${intent.action}: ${err.message}`)
    }
  }

  return NextResponse.json({ created, errors: errors.length > 0 ? errors : undefined })
}
