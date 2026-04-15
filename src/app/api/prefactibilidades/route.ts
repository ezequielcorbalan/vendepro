import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB, generateId } from '@/lib/db'

function slugify(text: string): string {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  try {
    const results = (await db.prepare(
      `SELECT p.*, u.full_name as agent_name FROM prefactibilidades p
       LEFT JOIN users u ON p.agent_id = u.id
       WHERE p.org_id = ? ORDER BY p.created_at DESC`
    ).bind(orgId).all()).results
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
  const slug = slugify(data.address || 'prefactibilidad') + '-' + id.slice(0, 6)

  await db.prepare(`
    INSERT INTO prefactibilidades (
      id, org_id, agent_id, lead_id, public_slug, status,
      address, neighborhood, city, lot_area, lot_frontage, lot_depth,
      zoning, fot, fos, max_height, lot_price, lot_price_per_m2, lot_description, lot_photos,
      project_name, project_description, buildable_area, total_units, units_mix,
      parking_spots, amenities, project_renders,
      construction_cost_per_m2, total_construction_cost, professional_fees, permits_cost,
      commercialization_cost, other_costs, total_investment,
      avg_sale_price_per_m2, total_sellable_area, projected_revenue,
      gross_margin, margin_pct, tir, payback_months,
      comparables, timeline, executive_summary, recommendation, video_url, agent_notes
    ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, orgId, user.id, data.lead_id || null, slug,
    data.address || '', data.neighborhood || null, data.city || 'Buenos Aires',
    data.lot_area || null, data.lot_frontage || null, data.lot_depth || null,
    data.zoning || null, data.fot || null, data.fos || null, data.max_height || null,
    data.lot_price || null, data.lot_price_per_m2 || null,
    data.lot_description || null, JSON.stringify(data.lot_photos || []),
    data.project_name || null, data.project_description || null,
    data.buildable_area || null, data.total_units || null,
    JSON.stringify(data.units_mix || []),
    data.parking_spots || null, JSON.stringify(data.amenities || []),
    JSON.stringify(data.project_renders || []),
    data.construction_cost_per_m2 || null, data.total_construction_cost || null,
    data.professional_fees || null, data.permits_cost || null,
    data.commercialization_cost || null, data.other_costs || null,
    data.total_investment || null,
    data.avg_sale_price_per_m2 || null, data.total_sellable_area || null,
    data.projected_revenue || null,
    data.gross_margin || null, data.margin_pct || null, data.tir || null,
    data.payback_months || null,
    JSON.stringify(data.comparables || []), JSON.stringify(data.timeline || []),
    data.executive_summary || null, data.recommendation || null,
    data.video_url || null, data.agent_notes || null
  ).run()

  return NextResponse.json({ id, slug })
}
