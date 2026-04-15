import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB, generateId } from '@/lib/db'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const leadId = searchParams.get('lead_id')

  try {
    if (id) {
      const ficha = await db.prepare('SELECT * FROM fichas_tasacion WHERE id = ?').bind(id).first()
      return NextResponse.json(ficha)
    }

    let query = 'SELECT f.*, u.full_name as agent_name FROM fichas_tasacion f LEFT JOIN users u ON f.agent_id = u.id WHERE f.org_id = ?'
    const binds: any[] = [user.org_id || 'org_mg']

    if (leadId) {
      query += ' AND f.lead_id = ?'
      binds.push(leadId)
    }

    query += ' ORDER BY f.created_at DESC'
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

  await db.prepare(`
    INSERT INTO fichas_tasacion (
      id, org_id, agent_id, lead_id, appraisal_id,
      inspection_date, address, neighborhood, property_type, floor_number,
      elevators, age, building_category, property_condition,
      covered_area, semi_area, uncovered_area, m2_value_neighborhood, m2_value_zone,
      bedrooms, bathrooms, storage_rooms, parking_spots, air_conditioning,
      bedroom_dimensions, living_dimensions, kitchen_dimensions, bathroom_dimensions,
      floor_type, disposition, orientation, balcony_type, heating_type, noise_level, amenities,
      is_professional, is_occupied, is_credit_eligible, sells_to_buy,
      expenses, abl, aysa, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, orgId, user.id, data.lead_id || null, data.appraisal_id || null,
    data.inspection_date || null, data.address || '', data.neighborhood || null, data.property_type || null, data.floor_number || null,
    data.elevators || null, data.age || null, data.building_category || null, data.property_condition || null,
    data.covered_area || null, data.semi_area || null, data.uncovered_area || null, data.m2_value_neighborhood || null, data.m2_value_zone || null,
    data.bedrooms || null, data.bathrooms || null, data.storage_rooms || null, data.parking_spots || null, data.air_conditioning || null,
    data.bedroom_dimensions || null, data.living_dimensions || null, data.kitchen_dimensions || null, data.bathroom_dimensions || null,
    data.floor_type || null, data.disposition || null, JSON.stringify(data.orientation || {}), data.balcony_type || null, data.heating_type || null, data.noise_level || null, JSON.stringify(data.amenities || []),
    data.is_professional ? 1 : 0, data.is_occupied ? 1 : 0, data.is_credit_eligible ? 1 : 0, data.sells_to_buy ? 1 : 0,
    data.expenses || null, data.abl || null, data.aysa || null, data.notes || null
  ).run()

  return NextResponse.json({ id })
}
