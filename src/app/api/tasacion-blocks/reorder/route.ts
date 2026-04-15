import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB } from '@/lib/db'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'admin' && user.role !== 'owner'))
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const { blocks } = (await request.json()) as { blocks: { id: string; sort_order: number }[] }
  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  for (const b of blocks) {
    await db.prepare(
      "UPDATE tasacion_template_blocks SET sort_order = ?, updated_at = datetime('now') WHERE id = ? AND org_id = ?"
    ).bind(b.sort_order, b.id, orgId).run()
  }

  return NextResponse.json({ success: true })
}
