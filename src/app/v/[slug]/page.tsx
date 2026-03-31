import { getDB } from '@/lib/db'
import VisitFormClient from './VisitFormClient'

export default async function VisitFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const db = await getDB()

  const property = (await db.prepare(
    "SELECT id, address, neighborhood, city, property_type, rooms, size_m2, asking_price, currency, org_id FROM properties WHERE public_slug = ?"
  ).bind(slug).first()) as any

  if (!property) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm max-w-md">
          <p className="text-6xl mb-4">🏠</p>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Propiedad no encontrada</h1>
          <p className="text-gray-500 text-sm">El link puede haber expirado o la propiedad fue removida.</p>
        </div>
      </div>
    )
  }

  // Get org branding
  let org: any = null
  try {
    org = await db.prepare("SELECT name, logo_url, brand_color FROM organizations WHERE id = ?")
      .bind(property.org_id || 'org_mg').first()
  } catch { /* */ }

  return (
    <VisitFormClient
      property={property}
      orgName={org?.name || 'Marcela Genta Operaciones Inmobiliarias'}
      brandColor={org?.brand_color || '#ff007c'}
    />
  )
}
