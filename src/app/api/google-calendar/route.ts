import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { fetchGoogleEvents, refreshAccessToken, createGoogleEvent } from '@/lib/google-calendar'

// GET /api/google-calendar?start=YYYY-MM-DD&end=YYYY-MM-DD
// Returns merged Google Calendar events with entity matching
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const { searchParams } = new URL(request.url)
  const start = searchParams.get('start') || new Date().toISOString().split('T')[0]
  const end = searchParams.get('end') || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  // Check if user has Google tokens
  const tokens = (await db.prepare(
    'SELECT * FROM google_tokens WHERE user_id = ?'
  ).bind(user.id).first()) as any

  if (!tokens) {
    return NextResponse.json({ connected: false, events: [] })
  }

  try {
    // Check if token expired, refresh if needed
    let accessToken = tokens.access_token
    if (tokens.expires_at && new Date(tokens.expires_at) < new Date()) {
      if (!tokens.refresh_token) {
        return NextResponse.json({ connected: false, events: [], error: 'Token expired, reconnect' })
      }
      const refreshed = await refreshAccessToken(tokens.refresh_token)
      accessToken = refreshed.access_token
      const newExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
      await db.prepare(
        'UPDATE google_tokens SET access_token = ?, expires_at = ?, updated_at = datetime(\'now\') WHERE user_id = ?'
      ).bind(accessToken, newExpires, user.id).run()
    }

    // Fetch Google events
    const googleEvents = await fetchGoogleEvents(accessToken, start + 'T00:00:00', end + 'T23:59:59')

    // Entity matching: load leads + contacts for this org
    const orgId = user.org_id || 'org_mg'
    const leads = (await db.prepare(
      'SELECT id, full_name, phone FROM leads WHERE org_id = ? AND stage NOT IN (\'perdido\')'
    ).bind(orgId).all()).results as any[]

    const contacts = (await db.prepare(
      'SELECT id, full_name, phone FROM contacts WHERE org_id = ?'
    ).bind(orgId).all()).results as any[]

    // Match events to entities by name
    const enriched = googleEvents.map(ev => {
      const titleLower = (ev.title + ' ' + ev.description).toLowerCase()
      let lead_id = null, lead_name = null
      let contact_id = null, contact_name = null

      // Try to match lead by name
      for (const lead of leads) {
        if (lead.full_name && titleLower.includes(lead.full_name.toLowerCase())) {
          lead_id = lead.id
          lead_name = lead.full_name
          break
        }
      }

      // Try to match contact if no lead matched
      if (!lead_id) {
        for (const contact of contacts) {
          if (contact.full_name && titleLower.includes(contact.full_name.toLowerCase())) {
            contact_id = contact.id
            contact_name = contact.full_name
            break
          }
        }
      }

      return { ...ev, lead_id, lead_name, contact_id, contact_name }
    })

    return NextResponse.json({
      connected: true,
      google_email: tokens.google_email,
      events: enriched,
    })
  } catch (err: any) {
    if (err.message === 'TOKEN_EXPIRED') {
      // Token expired and refresh failed
      return NextResponse.json({ connected: false, events: [], error: 'Token expired' })
    }
    return NextResponse.json({ connected: true, events: [], error: err.message })
  }
}

// POST /api/google-calendar — push a CRM event to Google Calendar
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const tokens = (await db.prepare(
    'SELECT * FROM google_tokens WHERE user_id = ?'
  ).bind(user.id).first()) as any

  if (!tokens) {
    return NextResponse.json({ error: 'Google Calendar not connected' }, { status: 400 })
  }

  const data = (await request.json()) as any

  try {
    let accessToken = tokens.access_token
    if (tokens.expires_at && new Date(tokens.expires_at) < new Date() && tokens.refresh_token) {
      const refreshed = await refreshAccessToken(tokens.refresh_token)
      accessToken = refreshed.access_token
      const newExpires = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
      await db.prepare(
        'UPDATE google_tokens SET access_token = ?, expires_at = ?, updated_at = datetime(\'now\') WHERE user_id = ?'
      ).bind(accessToken, newExpires, user.id).run()
    }

    const googleId = await createGoogleEvent(accessToken, {
      title: data.title,
      description: data.description,
      start_at: data.start_at,
      end_at: data.end_at,
      location: data.location,
    })

    return NextResponse.json({ google_id: googleId })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
