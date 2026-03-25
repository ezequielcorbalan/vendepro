import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// GET — check if user has Google Calendar connected
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const tokens = (await db.prepare(
    'SELECT google_email, expires_at, updated_at FROM google_tokens WHERE user_id = ?'
  ).bind(user.id).first()) as any

  if (!tokens) return NextResponse.json({ connected: false })

  return NextResponse.json({
    connected: true,
    google_email: tokens.google_email,
    expires_at: tokens.expires_at,
    last_sync: tokens.updated_at,
  })
}

// DELETE — disconnect Google Calendar
export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  await db.prepare('DELETE FROM google_tokens WHERE user_id = ?').bind(user.id).run()
  return NextResponse.json({ disconnected: true })
}
