import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getDB, getR2, generateId } from '@/lib/db'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  const org = await db.prepare(
    'SELECT name, slug, logo_url, brand_color, brand_accent_color FROM organizations WHERE id = ?'
  ).bind(orgId).first() as any

  if (!org) return NextResponse.json({ error: 'Org no encontrada' }, { status: 404 })

  return NextResponse.json(org)
}

export async function PUT(request: Request) {
  const user = await getCurrentUser()
  if (!user || (user.role !== 'admin' && user.role !== 'owner'))
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })

  const db = await getDB()
  const orgId = user.org_id || 'org_mg'

  const contentType = request.headers.get('content-type') || ''

  // Handle logo upload via FormData
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('logo') as File | null
    if (!file) return NextResponse.json({ error: 'No se envió archivo' }, { status: 400 })

    const r2 = await getR2()
    const ext = file.name.split('.').pop() || 'png'
    const key = `branding/${orgId}/logo.${ext}`
    const bytes = await file.arrayBuffer()
    await r2.put(key, bytes, {
      httpMetadata: { contentType: file.type || 'image/png' },
    })

    const logoUrl = `/api/photo/branding/${orgId}/logo.${ext}`
    await db.prepare(
      'UPDATE organizations SET logo_url = ? WHERE id = ?'
    ).bind(logoUrl, orgId).run()

    return NextResponse.json({ logo_url: logoUrl })
  }

  // Handle JSON update (colors)
  const body = (await request.json()) as any
  const fields: string[] = []
  const values: any[] = []

  if (body.brand_color) { fields.push('brand_color = ?'); values.push(body.brand_color) }
  if (body.brand_accent_color) { fields.push('brand_accent_color = ?'); values.push(body.brand_accent_color) }
  if (body.name) { fields.push('name = ?'); values.push(body.name) }

  if (fields.length === 0) return NextResponse.json({ error: 'Nada para actualizar' }, { status: 400 })

  values.push(orgId)
  await db.prepare(
    `UPDATE organizations SET ${fields.join(', ')} WHERE id = ?`
  ).bind(...values).run()

  return NextResponse.json({ success: true })
}
