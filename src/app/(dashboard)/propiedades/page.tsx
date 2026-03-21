import { getProperties } from '@/lib/actions'
import Link from 'next/link'
import { Building2, Plus } from 'lucide-react'

export default async function PropiedadesPage() {
  const properties = await getProperties()

  const statusLabel: Record<string, string> = {
    active: 'Activa', sold: 'Vendida', suspended: 'Pausada', archived: 'Archivada',
  }
  const statusColor: Record<string, string> = {
    active: 'bg-green-100 text-green-700', sold: 'bg-pink-100 text-brand-pink',
    suspended: 'bg-yellow-100 text-yellow-700', archived: 'bg-gray-100 text-gray-500',
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Propiedades</h1>
          <p className="text-brand-gray text-sm mt-1">{properties.length} propiedad{properties.length !== 1 ? 'es' : ''}</p>
        </div>
        <Link href="/propiedades/nueva" className="inline-flex items-center gap-2 bg-brand-pink text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> Nueva propiedad
        </Link>
      </div>

      {properties.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <Building2 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-800 mb-2">Sin propiedades</h2>
          <p className="text-brand-gray mb-4">Creá tu primera propiedad para empezar a generar reportes</p>
          <Link href="/propiedades/nueva" className="inline-flex items-center gap-2 bg-brand-pink text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Nueva propiedad
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property: any) => (
            <Link key={property.id} href={`/propiedades/${property.id}`} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              <div className="h-40 bg-gradient-to-br from-brand-pink/20 to-brand-orange/20 flex items-center justify-center">
                <Building2 className="w-12 h-12 text-brand-pink/40" />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[property.status]}`}>
                    {statusLabel[property.status]}
                  </span>
                  <span className="text-xs text-brand-gray">{property.report_count || 0} reportes</span>
                </div>
                <h3 className="font-semibold text-gray-800 mb-1">{property.address}</h3>
                <p className="text-sm text-brand-gray">{property.neighborhood} &middot; {property.property_type}</p>
                {property.asking_price && (
                  <p className="text-sm font-medium text-brand-pink mt-2">{property.currency} {Number(property.asking_price).toLocaleString('es-AR')}</p>
                )}
                {property.agent_name && <p className="text-xs text-brand-gray mt-2">Agente: {property.agent_name}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
