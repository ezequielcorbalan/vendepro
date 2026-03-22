import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()

  try {
    const appraisal = await db.prepare(
      'SELECT a.*, u.full_name as agent_name, u.phone as agent_phone, u.email as agent_email FROM appraisals a LEFT JOIN users u ON a.agent_id = u.id WHERE a.id = ?'
    ).bind(id).first()

    if (!appraisal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const comparables = (await db.prepare(
      'SELECT * FROM appraisal_comparables WHERE appraisal_id = ? ORDER BY sort_order'
    ).bind(id).all()).results

    return NextResponse.json({ ...appraisal, comparables })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()

  try {
    await db.prepare('DELETE FROM appraisal_comparables WHERE appraisal_id = ?').bind(id).run()
    await db.prepare('DELETE FROM appraisals WHERE id = ?').bind(id).run()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
