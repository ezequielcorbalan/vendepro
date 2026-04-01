import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  try {
    const agents = (await db.prepare(
      `SELECT id, full_name, email, phone, role, created_at FROM users WHERE org_id = ? ORDER BY full_name ASC`
    ).bind(orgId).all()).results
    return NextResponse.json(agents)
  } catch {
    return NextResponse.json([])
  }
}

// PUT /api/agents — change role
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })
  if (user.role !== 'admin' && user.role !== 'owner') {
    return NextResponse.json({ error: 'Solo admins pueden cambiar roles' }, { status: 403 })
  }

  const data = (await request.json()) as any
  if (!data.id || !data.role) return NextResponse.json({ error: 'Faltan campos' }, { status: 400 })

  const validRoles = ['admin', 'supervisor', 'agent']
  if (!validRoles.includes(data.role)) {
    return NextResponse.json({ error: 'Rol no v\u00e1lido' }, { status: 400 })
  }

  if (data.id === user.id) {
    return NextResponse.json({ error: 'No pod\u00e9s cambiar tu propio rol' }, { status: 400 })
  }

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  try {
    await db.prepare("UPDATE users SET role = ? WHERE id = ? AND org_id = ?")
      .bind(data.role, data.id, orgId).run()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/agents?id=xxx
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No auth' }, { status: 401 })
  if (user.role !== 'admin' && user.role !== 'owner') {
    return NextResponse.json({ error: 'Solo admins pueden eliminar agentes' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  if (id === user.id) {
    return NextResponse.json({ error: 'No pod\u00e9s eliminarte a vos mismo' }, { status: 400 })
  }

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  try {
    await db.prepare("DELETE FROM users WHERE id = ? AND org_id = ?")
      .bind(id, orgId).run()
    return NextResponse.json({ deleted: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
