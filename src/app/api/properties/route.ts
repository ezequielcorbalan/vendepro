import { getCurrentUser } from '@/lib/auth'
import { getDB, generateId } from '@/lib/db'
import { slugify } from '@/lib/utils'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const body = await request.json() as any
  const db = await getDB()
  const id = generateId()
  const slug = slugify(`${body.address}-${body.neighborhood}`)

  try {
    await db.prepare(`
      INSERT INTO properties (id, address, neighborhood, city, property_type, rooms, size_m2,
        asking_price, currency, owner_name, owner_phone, owner_email, public_slug, agent_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, body.address, body.neighborhood, body.city || 'Buenos Aires',
      body.property_type || 'departamento',
      body.rooms ? parseInt(body.rooms) : null,
      body.size_m2 ? parseFloat(body.size_m2) : null,
      body.asking_price ? parseFloat(body.asking_price) : null,
      body.currency || 'USD',
      body.owner_name, body.owner_phone || null, body.owner_email || null,
      slug, user.id
    ).run()

    return NextResponse.json({ id, slug })
  } catch (err: any) {
    if (err.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Ya existe una propiedad con esa dirección' }, { status: 400 })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
