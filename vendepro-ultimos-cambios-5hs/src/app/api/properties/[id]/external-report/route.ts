import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB } from '@/lib/db'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { id } = await params
  const db = await getDB()

  try {
    await db.prepare(
      "UPDATE properties SET last_external_report_at = datetime('now') WHERE id = ?"
    ).bind(id).run()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { id } = await params
  const db = await getDB()

  try {
    await db.prepare(
      "UPDATE properties SET last_external_report_at = NULL WHERE id = ?"
    ).bind(id).run()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error' }, { status: 500 })
  }
}
