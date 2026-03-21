import { getDashboardStats } from '@/lib/actions'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, FileBarChart, Plus, TrendingUp, Eye } from 'lucide-react'

export default async function DashboardPage() {
  const data = await getDashboardStats()
  if (!data) redirect('/login')

  const { user, properties, isAdmin } = data

  const activeProperties = properties.filter((p: any) => p.status === 'active')
  const totalReports = properties.reduce((acc: number, p: any) => acc + (p.report_count || 0), 0)
  const publishedReports = properties.reduce((acc: number, p: any) => acc + (p.published_count || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
          <p className="text-brand-gray text-sm mt-1">Hola, {user.full_name}</p>
        </div>
        <Link
          href="/propiedades/nueva"
          className="inline-flex items-center gap-2 bg-brand-pink text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Nueva propiedad
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-brand-pink/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-brand-pink" />
            </div>
            <span className="text-sm text-brand-gray">Propiedades activas</span>
          </div>
          <p className="text-3xl font-semibold text-gray-800">{activeProperties.length}</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-brand-orange/10 flex items-center justify-center">
              <FileBarChart className="w-5 h-5 text-brand-orange" />
            </div>
            <span className="text-sm text-brand-gray">Reportes totales</span>
          </div>
          <p className="text-3xl font-semibold text-gray-800">{totalReports}</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-brand-gray">Reportes publicados</span>
          </div>
          <p className="text-3xl font-semibold text-gray-800">{publishedReports}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Propiedades recientes</h2>
        </div>
        {properties.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-brand-gray">No tenés propiedades todavía</p>
            <Link href="/propiedades/nueva" className="text-brand-pink text-sm font-medium mt-2 inline-block hover:underline">
              Crear la primera
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {properties.slice(0, 5).map((property: any) => (
              <Link
                key={property.id}
                href={`/propiedades/${property.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-brand-light flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-brand-gray" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{property.address}</p>
                    <p className="text-sm text-brand-gray">
                      {property.neighborhood} &middot; {property.property_type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-brand-gray">{property.report_count || 0} reportes</span>
                  <Eye className="w-4 h-4 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
