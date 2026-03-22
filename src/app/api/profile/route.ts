import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB } from '@/lib/db'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const body = (await request.json()) as any
  const db = await getDB()

  if (body.photo_url !== undefined) {
    await db.prepare('UPDATE users SET photo_url = ? WHERE id = ?').bind(body.photo_url || null, user.id).run()
  }

  return NextResponse.json({ success: true })
}
