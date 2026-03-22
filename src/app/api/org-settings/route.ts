import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB, generateId } from '@/lib/db'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = await getDB()
  const orgId = 'org_mg'

  const settings = (await db.prepare(
    'SELECT setting_key, setting_value FROM org_settings WHERE org_id = ?'
  ).bind(orgId).all()).results as any[]

  const result: Record<string, string> = {}
  for (const s of settings) {
    result[s.setting_key] = s.setting_value
  }

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const body = await request.json() as Record<string, string>
  const db = await getDB()
  const orgId = 'org_mg'

  for (const [key, value] of Object.entries(body)) {
    const existing = await db.prepare(
      'SELECT id FROM org_settings WHERE org_id = ? AND setting_key = ?'
    ).bind(orgId, key).first()

    if (existing) {
      await db.prepare(
        'UPDATE org_settings SET setting_value = ?, updated_at = datetime(\'now\') WHERE org_id = ? AND setting_key = ?'
      ).bind(value, orgId, key).run()
    } else {
      await db.prepare(
        'INSERT INTO org_settings (id, org_id, setting_key, setting_value) VALUES (?, ?, ?, ?)'
      ).bind(generateId(), orgId, key, value).run()
    }
  }

  return NextResponse.json({ success: true })
}
