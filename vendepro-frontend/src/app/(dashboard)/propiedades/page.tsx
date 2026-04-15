import { getProperties } from '@/lib/actions'
import Link from 'next/link'
import { Building2, Plus } from 'lucide-react'
import PropertyFilters from '@/components/properties/PropertyFilters'

export default async function PropiedadesPage() {
  const properties = await getProperties()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Reportes</h1>
          <p className="text-brand-gray text-sm mt-1">Gestión de reportes quincenales · {properties.length} propiedades</p>
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
        <PropertyFilters properties={properties as any[]} />
      )}
    </div>
  )
}
