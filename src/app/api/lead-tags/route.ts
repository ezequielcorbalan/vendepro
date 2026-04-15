import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB } from '@/lib/db'

// GET: tags for a specific lead
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('lead_id')
  if (!leadId) return NextResponse.json({ error: 'lead_id required' }, { status: 400 })

  const db = await getDB()
  try {
    const tags = (await db.prepare(
      'SELECT t.* FROM tags t INNER JOIN lead_tags lt ON t.id = lt.tag_id WHERE lt.lead_id = ?'
    ).bind(leadId).all()).results as any[]
    return NextResponse.json(tags)
  } catch {
    return NextResponse.json([])
  }
}

// POST: add tag to lead
export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const body = (await request.json()) as any
  const db = await getDB()

  try {
    await db.prepare(
      'INSERT OR IGNORE INTO lead_tags (lead_id, tag_id) VALUES (?, ?)'
    ).bind(body.lead_id, body.tag_id).run()
  } catch { /* already exists */ }

  return NextResponse.json({ success: true })
}

// DELETE: remove tag from lead
export async function DELETE(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('lead_id')
  const tagId = searchParams.get('tag_id')
  if (!leadId || !tagId) return NextResponse.json({ error: 'lead_id and tag_id required' }, { status: 400 })

  const db = await getDB()
  await db.prepare(
    'DELETE FROM lead_tags WHERE lead_id = ? AND tag_id = ?'
  ).bind(leadId, tagId).run()

  return NextResponse.json({ success: true })
}
