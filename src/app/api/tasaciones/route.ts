import { NextRequest, NextResponse } from 'next/server'
import { getDB, generateId } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const data = (await request.json()) as any
  const db = await getDB()
  const id = generateId()

  try {
    await db.prepare(`
      INSERT INTO appraisals (id, org_id, property_address, neighborhood, city, property_type,
        covered_area, total_area, semi_area, weighted_area, strengths, weaknesses, opportunities,
        threats, publication_analysis, suggested_price, test_price, expected_close_price, usd_per_m2,
        agent_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
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
      user.id
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

    return NextResponse.json({ id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error al guardar' }, { status: 500 })
  }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const isAdmin = user.role === 'admin' || user.role === 'owner'

  try {
    const query = isAdmin
      ? `SELECT a.*, u.full_name as agent_name FROM appraisals a LEFT JOIN users u ON a.agent_id = u.id ORDER BY a.created_at DESC`
      : `SELECT a.* FROM appraisals a WHERE a.agent_id = ? ORDER BY a.created_at DESC`

    const results = isAdmin
      ? (await db.prepare(query).all()).results
      : (await db.prepare(query).bind(user.id).all()).results

    return NextResponse.json(results)
  } catch {
    return NextResponse.json([])
  }
}
