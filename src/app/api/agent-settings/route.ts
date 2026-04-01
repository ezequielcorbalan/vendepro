import { NextRequest, NextResponse } from 'next/server'
import { getDB, generateId } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

// GET /api/agent-settings?agent_id=xxx (optional, defaults to current user)
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const agentId = searchParams.get('agent_id') || user.id
  const db = await getDB()

  try {
    const rows = (await db.prepare(
      'SELECT setting_key, setting_value FROM agent_settings WHERE agent_id = ?'
    ).bind(agentId).all()).results as any[]

    const settings: Record<string, string> = {}
    for (const r of rows) settings[r.setting_key] = r.setting_value
    return NextResponse.json(settings)
  } catch {
    return NextResponse.json({})
  }
}

// PUT /api/agent-settings — save multiple settings
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const data = (await request.json()) as any
  const db = await getDB()

  try {
    for (const [key, value] of Object.entries(data)) {
      if (key === 'agent_id') continue
      await db.prepare(`
        INSERT INTO agent_settings (id, agent_id, setting_key, setting_value, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(agent_id, setting_key) DO UPDATE SET
          setting_value = excluded.setting_value,
          updated_at = datetime('now')
      `).bind(generateId(), user.id, key, value || null).run()
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
