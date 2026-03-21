'use server'

import { getDB, generateId } from './db'
import { getCurrentUser, createUser, hashPassword } from './auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { slugify } from './utils'

// ============================================================
// Properties
// ============================================================

export async function getProperties() {
  const user = await getCurrentUser()
  if (!user) return []

  const db = await getDB()
  const isAdmin = user.role === 'admin'

  if (isAdmin) {
    return (await db.prepare(`
      SELECT p.*, u.full_name as agent_name,
        (SELECT COUNT(*) FROM reports r WHERE r.property_id = p.id) as report_count
      FROM properties p
      LEFT JOIN users u ON p.agent_id = u.id
      ORDER BY p.updated_at DESC
    `).all()).results
  }

  return (await db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM reports r WHERE r.property_id = p.id) as report_count
    FROM properties p
    WHERE p.agent_id = ?
    ORDER BY p.updated_at DESC
  `).bind(user.id).all()).results
}

export async function getProperty(id: string) {
  const db = await getDB()
  const property = await db.prepare(`
    SELECT p.*, u.full_name as agent_name, u.phone as agent_phone, u.email as agent_email
    FROM properties p
    LEFT JOIN users u ON p.agent_id = u.id
    WHERE p.id = ?
  `).bind(id).first()

  if (!property) return null

  const reports = (await db.prepare(`
    SELECT r.*, u.full_name as creator_name
    FROM reports r
    LEFT JOIN users u ON r.created_by = u.id
    WHERE r.property_id = ?
    ORDER BY r.period_start DESC
  `).bind(id).all()).results

  return { ...property, reports }
}

export async function createProperty(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const id = generateId()
  const address = formData.get('address') as string
  const neighborhood = formData.get('neighborhood') as string
  const slug = slugify(`${address}-${neighborhood}`)

  await db.prepare(`
    INSERT INTO properties (id, address, neighborhood, city, property_type, rooms, size_m2,
      asking_price, currency, owner_name, owner_phone, owner_email, public_slug, agent_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    address,
    neighborhood,
    formData.get('city') || 'Buenos Aires',
    formData.get('property_type') || 'departamento',
    formData.get('rooms') ? parseInt(formData.get('rooms') as string) : null,
    formData.get('size_m2') ? parseFloat(formData.get('size_m2') as string) : null,
    formData.get('asking_price') ? parseFloat(formData.get('asking_price') as string) : null,
    formData.get('currency') || 'USD',
    formData.get('owner_name') as string,
    formData.get('owner_phone') || null,
    formData.get('owner_email') || null,
    slug,
    user.id
  ).run()

  redirect(`/propiedades/${id}`)
}

export async function updatePropertyStatus(propertyId: string, status: 'active' | 'sold' | 'suspended' | 'archived') {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  await db.prepare('UPDATE properties SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(status, propertyId).run()

  revalidatePath(`/propiedades/${propertyId}`)
  revalidatePath('/propiedades')
}

// ============================================================
// Reports
// ============================================================

export async function createReport(propertyId: string, data: {
  periodLabel: string
  periodStart: string
  periodEnd: string
  metrics: any[]
  strategy: string
  marketing: string
  conclusion: string
  priceReference: string
  competitors: any[]
  publish: boolean
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const db = await getDB()
  const reportId = generateId()

  // Create report
  await db.prepare(`
    INSERT INTO reports (id, property_id, period_label, period_start, period_end, status, created_by, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    reportId, propertyId, data.periodLabel, data.periodStart, data.periodEnd,
    data.publish ? 'published' : 'draft', user.id,
    data.publish ? new Date().toISOString() : null
  ).run()

  // Insert metrics
  for (const m of data.metrics) {
    const metricId = generateId()
    await db.prepare(`
      INSERT INTO report_metrics (id, report_id, source, impressions, portal_visits, inquiries,
        phone_calls, whatsapp, in_person_visits, offers, ranking_position, avg_market_price)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      metricId, reportId, m.source,
      m.impressions ? parseInt(m.impressions) : null,
      m.portal_visits ? parseInt(m.portal_visits) : null,
      m.inquiries ? parseInt(m.inquiries) : null,
      m.phone_calls ? parseInt(m.phone_calls) : null,
      m.whatsapp ? parseInt(m.whatsapp) : null,
      m.in_person_visits ? parseInt(m.in_person_visits) : null,
      m.offers ? parseInt(m.offers) : null,
      m.ranking_position ? parseInt(m.ranking_position) : null,
      m.avg_market_price ? parseFloat(m.avg_market_price) : null
    ).run()
  }

  // Insert content sections
  const sections = [
    { section: 'strategy', title: 'Estrategia comercial', body: data.strategy },
    { section: 'marketing', title: 'Marketing y difusión', body: data.marketing },
    { section: 'conclusion', title: 'Conclusión', body: data.conclusion },
    { section: 'price_reference', title: 'Referencia de precio', body: data.priceReference },
  ]

  for (let i = 0; i < sections.length; i++) {
    if (sections[i].body?.trim()) {
      await db.prepare(`
        INSERT INTO report_content (id, report_id, section, title, body, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(generateId(), reportId, sections[i].section, sections[i].title, sections[i].body, i).run()
    }
  }

  // Insert competitor links
  for (const comp of data.competitors) {
    if (comp.url?.trim()) {
      await db.prepare(`
        INSERT INTO competitor_links (id, property_id, url, address, price, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        generateId(), propertyId, comp.url,
        comp.address || null,
        comp.price ? parseFloat(comp.price) : null,
        comp.notes || null
      ).run()
    }
  }

  revalidatePath(`/propiedades/${propertyId}`)
  return reportId
}

// ============================================================
// Public report data (no auth required)
// ============================================================

export async function getPublicReport(slug: string) {
  const db = await getDB()

  const property = await db.prepare(`
    SELECT p.*, u.full_name as agent_name, u.phone as agent_phone, u.email as agent_email
    FROM properties p
    LEFT JOIN users u ON p.agent_id = u.id
    WHERE p.public_slug = ?
  `).bind(slug).first()

  if (!property) return null

  // Get all published reports with metrics and content
  const reports = (await db.prepare(`
    SELECT * FROM reports WHERE property_id = ? AND status = 'published' ORDER BY period_start ASC
  `).bind(property.id as string).all()).results

  for (const report of reports) {
    (report as any).metrics = (await db.prepare(
      'SELECT * FROM report_metrics WHERE report_id = ?'
    ).bind(report.id as string).all()).results;

    (report as any).content = (await db.prepare(
      'SELECT * FROM report_content WHERE report_id = ? ORDER BY sort_order'
    ).bind(report.id as string).all()).results;

    (report as any).photos = (await db.prepare(
      'SELECT * FROM report_photos WHERE report_id = ? ORDER BY sort_order'
    ).bind(report.id as string).all()).results
  }

  // Get competitor links
  const competitors = (await db.prepare(
    'SELECT * FROM competitor_links WHERE property_id = ? ORDER BY created_at DESC'
  ).bind(property.id as string).all()).results

  return { property, reports, competitors }
}

// ============================================================
// Dashboard stats
// ============================================================

export async function getDashboardStats() {
  const user = await getCurrentUser()
  if (!user) return null

  const db = await getDB()
  const isAdmin = user.role === 'admin'

  const whereClause = isAdmin ? '' : 'WHERE p.agent_id = ?'
  const bindings = isAdmin ? [] : [user.id]

  const properties = (await db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM reports r WHERE r.property_id = p.id) as report_count,
      (SELECT COUNT(*) FROM reports r WHERE r.property_id = p.id AND r.status = 'published') as published_count
    FROM properties p ${whereClause} ORDER BY p.updated_at DESC
  `).bind(...bindings).all()).results

  return { user, properties, isAdmin }
}

// ============================================================
// Agents (admin only)
// ============================================================

export async function getAgents() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return []

  const db = await getDB()
  return (await db.prepare('SELECT id, email, full_name, phone, role, created_at FROM users ORDER BY created_at DESC').all()).results
}

export async function createAgent(data: {
  email: string; password: string; full_name: string; phone?: string; role: string
}) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return { error: 'Sin permisos' }

  return createUser(data.email, data.password, data.full_name, data.role as 'admin' | 'agent', data.phone)
}
