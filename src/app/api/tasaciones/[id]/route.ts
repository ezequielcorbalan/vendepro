import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB } from '@/lib/db'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { id } = await params
  const db = await getDB()

  try {
    const appraisal = await db.prepare('SELECT * FROM appraisals WHERE id = ?').bind(id).first() as any
    if (!appraisal) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    if (user.role !== 'admin' && appraisal.agent_id !== user.id) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    await db.prepare('DELETE FROM appraisal_comparables WHERE appraisal_id = ?').bind(id).run()
    await db.prepare('DELETE FROM appraisals WHERE id = ?').bind(id).run()

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { id } = await params
  const body = (await request.json()) as any
  const db = await getDB()

  try {
    const fields: string[] = []
    const values: any[] = []

    const allowedFields = [
      'property_address', 'neighborhood', 'city', 'property_type',
      'covered_area', 'total_area', 'semi_area', 'weighted_area',
      'strengths', 'weaknesses', 'opportunities', 'threats',
      'publication_analysis', 'suggested_price', 'test_price',
      'expected_close_price', 'usd_per_m2', 'video_url', 'status',
      'agent_notes', 'zone_avg_price', 'zone_avg_m2', 'zone_avg_usd_m2',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        fields.push(`${field} = ?`)
        values.push(body[field])
      }
    }

    if (fields.length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })

    fields.push('updated_at = datetime(\'now\')')
    values.push(id)

    await db.prepare(`UPDATE appraisals SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { id } = await params
  const db = await getDB()

  const appraisal = await db.prepare(
    'SELECT a.*, u.full_name as agent_name FROM appraisals a LEFT JOIN users u ON a.agent_id = u.id WHERE a.id = ?'
  ).bind(id).first()

  if (!appraisal) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

  const comparables = (await db.prepare(
    'SELECT * FROM appraisal_comparables WHERE appraisal_id = ? ORDER BY sort_order'
  ).bind(id).all()).results

  return NextResponse.json({ ...appraisal, comparables })
}
