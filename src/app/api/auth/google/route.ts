import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getAuthUrl } from '@/lib/google-calendar'

// GET /api/auth/google — redirects to Google OAuth
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  // State = user ID to link back after callback
  const authUrl = getAuthUrl(user.id)
  return NextResponse.redirect(authUrl)
}
