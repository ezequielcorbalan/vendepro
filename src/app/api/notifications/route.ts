import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// GET /api/notifications — compute real-time alerts for current user
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'
  const isAdmin = user.role === 'admin' || user.role === 'owner'
  const now = new Date(Date.now() - 3 * 3600000) // AR timezone
  const today = now.toISOString().split('T')[0]

  const notifications: { id: string; type: string; title: string; body: string; link: string; urgency: 'high' | 'medium' | 'low'; created_at: string }[] = []

  try {
    // 1. Leads sin contactar > 24h
    const agentFilter = isAdmin ? '' : ' AND assigned_to = ?'
    const agentBinds = isAdmin ? [orgId] : [orgId, user.id]
    const staleLeads = (await db.prepare(`
      SELECT id, full_name, created_at FROM leads
      WHERE org_id = ? AND stage = 'nuevo' AND created_at < datetime('now', '-1 day')${agentFilter}
      ORDER BY created_at ASC LIMIT 5
    `).bind(...agentBinds).all()).results as any[]

    staleLeads.forEach(l => {
      notifications.push({
        id: `stale_${l.id}`,
        type: 'lead_stale',
        title: 'Lead sin contactar',
        body: `${l.full_name} lleva más de 24hs sin contacto`,
        link: `/leads/${l.id}`,
        urgency: 'high',
        created_at: l.created_at,
      })
    })

    // 2. Seguimientos pendientes (eventos vencidos)
    const overdueEvents = (await db.prepare(`
      SELECT ce.id, ce.title, ce.start_at, ce.lead_id FROM calendar_events ce
      WHERE ce.org_id = ? AND ce.completed = 0 AND ce.start_at < ?
      ${isAdmin ? '' : ' AND ce.agent_id = ?'}
      ORDER BY ce.start_at DESC LIMIT 5
    `).bind(...(isAdmin ? [orgId, today] : [orgId, today, user.id])).all()).results as any[]

    overdueEvents.forEach(e => {
      notifications.push({
        id: `overdue_${e.id}`,
        type: 'event_overdue',
        title: 'Seguimiento vencido',
        body: e.title,
        link: '/calendario',
        urgency: 'high',
        created_at: e.start_at,
      })
    })

    // 3. Leads en seguimiento sin actividad reciente (> 5 días)
    const coldLeads = (await db.prepare(`
      SELECT l.id, l.full_name, l.updated_at FROM leads l
      WHERE l.org_id = ? AND l.stage = 'seguimiento' AND l.updated_at < datetime('now', '-5 days')
      ${isAdmin ? '' : ' AND l.assigned_to = ?'}
      ORDER BY l.updated_at ASC LIMIT 5
    `).bind(...(isAdmin ? [orgId] : [orgId, user.id])).all()).results as any[]

    coldLeads.forEach(l => {
      notifications.push({
        id: `cold_${l.id}`,
        type: 'lead_cold',
        title: 'Lead frío',
        body: `${l.full_name} sin actividad hace 5+ días`,
        link: `/leads/${l.id}`,
        urgency: 'medium',
        created_at: l.updated_at,
      })
    })

    // 4. Eventos de hoy
    const todayEvents = (await db.prepare(`
      SELECT id, title, start_at, event_type FROM calendar_events
      WHERE org_id = ? AND completed = 0 AND date(start_at) = ?
      ${isAdmin ? '' : ' AND agent_id = ?'}
      ORDER BY start_at ASC LIMIT 5
    `).bind(...(isAdmin ? [orgId, today] : [orgId, today, user.id])).all()).results as any[]

    todayEvents.forEach(e => {
      notifications.push({
        id: `today_${e.id}`,
        type: 'event_today',
        title: 'Evento hoy',
        body: e.title,
        link: '/calendario',
        urgency: 'low',
        created_at: e.start_at,
      })
    })

  } catch { /* graceful degradation */ }

  // Sort: high urgency first
  const urgencyOrder = { high: 0, medium: 1, low: 2 }
  notifications.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])

  return NextResponse.json({
    count: notifications.length,
    high: notifications.filter(n => n.urgency === 'high').length,
    notifications,
  })
}
