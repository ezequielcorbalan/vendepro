import { NextRequest, NextResponse } from 'next/server'
import { getDB, generateId } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { slugify } from '@/lib/utils'

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const data = (await request.json()) as any
  const db = await getDB()
  const id = generateId()
  const publicSlug = slugify(`${data.address}-${data.neighborhood}`)

  try {
    await db.prepare(`
      INSERT INTO appraisals (id, org_id, property_address, neighborhood, city, property_type,
        covered_area, total_area, semi_area, weighted_area, strengths, weaknesses, opportunities,
        threats, publication_analysis, suggested_price, test_price, expected_close_price, usd_per_m2,
        agent_id, status, video_url, public_slug, agent_notes, zone_avg_price, zone_avg_m2, zone_avg_usd_m2)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      user.org_id || 'org_mg',
      data.address,
      data.neighborhood,
      data.city || 'Buenos Aires',
      data.property_type || 'departamento',
      data.covered_area,
      data.total_area,
      data.semi_area,
      data.weighted_area,
      data.strengths || null,
      data.weaknesses || null,
      data.opportunities || null,
      data.threats || null,
      data.publication_analysis || null,
      data.suggested_price,
      data.test_price,
      data.expected_close_price,
      data.usd_per_m2,
      user.id,
      data.video_url || null,
      publicSlug,
      data.agent_notes || null,
      data.zone_avg_price || null,
      data.zone_avg_m2 || null,
      data.zone_avg_usd_m2 || null
    ).run()

    // Insert comparables
    if (data.comparables?.length > 0) {
      for (const comp of data.comparables) {
        await db.prepare(`
          INSERT INTO appraisal_comparables (id, appraisal_id, zonaprop_url, address, total_area,
            covered_area, price, usd_per_m2, days_on_market, views_per_day, age, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          generateId(), id,
          comp.zonaprop_url || null,
          comp.address || null,
          comp.total_area,
          comp.covered_area,
          comp.price,
          comp.usd_per_m2,
          comp.days_on_market,
          comp.views_per_day,
          comp.age,
          comp.sort_order || 0
        ).run()
      }
    }

    // Insert sold properties linked to this appraisal
    if (data.sold_properties?.length > 0) {
      for (const sp of data.sold_properties) {
        const spId = sp.id || generateId()
        // If it's a new sold property, insert into sold_properties table
        if (sp.isNew || !sp.id) {
          await db.prepare(`
            INSERT INTO sold_properties (id, org_id, address, neighborhood, property_type, total_area,
              sold_price, original_price, currency, sold_date, agent_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?)
          `).bind(
            spId, user.org_id || 'org_mg',
            sp.address, sp.neighborhood || data.neighborhood,
            sp.property_type || null,
            sp.total_area || null,
            sp.sold_price || null,
            sp.original_price || null,
            sp.sold_date || null,
            user.id
          ).run()
        }
        // Link sold property to this appraisal
        await db.prepare(`
          INSERT OR IGNORE INTO appraisal_sold_properties (appraisal_id, sold_property_id)
          VALUES (?, ?)
        `).bind(id, spId).run()
      }
    }

    // Update lead_id and contact info if provided (from lead conversion)
    if (data.lead_id || data.contact_name || data.contact_phone || data.contact_email) {
      try {
        await db.prepare(`
          UPDATE appraisals SET lead_id=?, contact_name=?, contact_phone=?, contact_email=?,
          property_address=COALESCE(NULLIF(property_address,''), ?),
          neighborhood=COALESCE(NULLIF(neighborhood,''), ?),
          agent_id=COALESCE(agent_id, ?)
          WHERE id=?
        `).bind(
          data.lead_id || null,
          data.contact_name || null,
          data.contact_phone || null,
          data.contact_email || null,
          data.property_address || null,
          data.neighborhood || null,
          data.agent_id || null,
          id
        ).run()
      } catch { /* columns may not exist yet, safe to ignore */ }
    }

    return NextResponse.json({ id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al guardar' }, { status: 500 })
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
      UPDATE appraisals SET property_address=?, neighborhood=?, city=?, property_type=?,
        covered_area=?, total_area=?, semi_area=?, weighted_area=?, strengths=?, weaknesses=?,
        opportunities=?, threats=?, publication_analysis=?, suggested_price=?, test_price=?,
        expected_close_price=?, usd_per_m2=?, video_url=?, agent_notes=?,
        zone_avg_price=?, zone_avg_m2=?, zone_avg_usd_m2=?, updated_at=datetime('now')
      WHERE id=? AND org_id=?
    `).bind(
      data.address, data.neighborhood, data.city || 'Buenos Aires',
      data.property_type || 'departamento',
      data.covered_area, data.total_area, data.semi_area, data.weighted_area,
      data.strengths || null, data.weaknesses || null,
      data.opportunities || null, data.threats || null,
      data.publication_analysis || null,
      data.suggested_price, data.test_price, data.expected_close_price, data.usd_per_m2,
      data.video_url || null, data.agent_notes || null,
      data.zone_avg_price || null, data.zone_avg_m2 || null, data.zone_avg_usd_m2 || null,
      data.id, user.org_id || 'org_mg'
    ).run()

    // Delete old comparables and re-insert
    await db.prepare('DELETE FROM appraisal_comparables WHERE appraisal_id = ?').bind(data.id).run()

    if (data.comparables?.length > 0) {
      for (const comp of data.comparables) {
        await db.prepare(`
          INSERT INTO appraisal_comparables (id, appraisal_id, zonaprop_url, address, total_area,
            covered_area, price, usd_per_m2, days_on_market, views_per_day, age, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          generateId(), data.id,
          comp.zonaprop_url || null, comp.address || null,
          comp.total_area, comp.covered_area, comp.price, comp.usd_per_m2,
          comp.days_on_market, comp.views_per_day, comp.age, comp.sort_order || 0
        ).run()
      }
    }

    // Update sold properties links
    await db.prepare('DELETE FROM appraisal_sold_properties WHERE appraisal_id = ?').bind(data.id).run()

    if (data.sold_properties?.length > 0) {
      for (const sp of data.sold_properties) {
        const spId = sp.id || generateId()
        if (sp.isNew || !sp.id) {
          await db.prepare(`
            INSERT INTO sold_properties (id, org_id, address, neighborhood, property_type, total_area,
              sold_price, original_price, currency, sold_date, agent_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'USD', ?, ?)
          `).bind(
            spId, user.org_id || 'org_mg',
            sp.address, sp.neighborhood || data.neighborhood,
            sp.property_type || null,
            sp.total_area || null,
            sp.sold_price || null,
            sp.original_price || null,
            sp.sold_date || null,
            user.id
          ).run()
        }
        await db.prepare(`
          INSERT OR IGNORE INTO appraisal_sold_properties (appraisal_id, sold_property_id)
          VALUES (?, ?)
        `).bind(data.id, spId).run()
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al actualizar' }, { status: 500 })
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
    const exists = await db.prepare('SELECT id FROM appraisals WHERE id = ? AND org_id = ?').bind(id, orgId).first()
    if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await db.prepare('DELETE FROM appraisal_comparables WHERE appraisal_id = ?').bind(id).run()
    await db.prepare('DELETE FROM appraisals WHERE id = ? AND org_id = ?').bind(id, orgId).run()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const isAdmin = user.role === 'admin' || user.role === 'owner'

  try {
    const orgId = user.org_id || 'org_mg'
    const query = isAdmin
      ? `SELECT a.*, u.full_name as agent_name FROM appraisals a LEFT JOIN users u ON a.agent_id = u.id WHERE a.org_id = ? ORDER BY a.created_at DESC`
      : `SELECT a.*, u.full_name as agent_name FROM appraisals a LEFT JOIN users u ON a.agent_id = u.id WHERE a.org_id = ? AND a.agent_id = ? ORDER BY a.created_at DESC`

    const results = isAdmin
      ? (await db.prepare(query).bind(orgId).all()).results
      : (await db.prepare(query).bind(orgId, user.id).all()).results

    return NextResponse.json(results)
  } catch {
    return NextResponse.json([])
  }
}
