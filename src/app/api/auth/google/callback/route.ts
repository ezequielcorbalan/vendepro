import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { exchangeCode, getGoogleEmail } from '@/lib/google-calendar'

// GET /api/auth/google/callback — Google redirects here after consent
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') // user ID
  const error = searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(new URL('/configuracion?gcal=error', request.url))
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code)
    const email = await getGoogleEmail(tokens.access_token)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Store tokens in DB
    const db = await getDB()
    await db.prepare(`
      INSERT INTO google_tokens (user_id, access_token, refresh_token, expires_at, google_email, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = COALESCE(excluded.refresh_token, google_tokens.refresh_token),
        expires_at = excluded.expires_at,
        google_email = excluded.google_email,
        updated_at = datetime('now')
    `).bind(state, tokens.access_token, tokens.refresh_token || null, expiresAt, email).run()

    return NextResponse.redirect(new URL('/configuracion?gcal=ok', request.url))
  } catch (err: any) {
    console.error('Google OAuth error:', err.message)
    return NextResponse.redirect(new URL('/configuracion?gcal=error', request.url))
  }
}
