import { getProperty, getPriceHistory } from '@/lib/actions'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, FileBarChart, ExternalLink, Clock, CheckCircle2, Trash2 } from 'lucide-react'
import DeleteReportButton from '@/components/reports/DeleteReportButton'
import PropertyStatusActions from '@/components/properties/PropertyStatusActions'
import PriceHistory from '@/components/properties/PriceHistory'
import DocumentChecklist from '@/components/properties/DocumentChecklist'
import { formatDate } from '@/lib/utils'

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const property = await getProperty(id) as any
  if (!property) notFound()

  const reports = (property.reports || []) as any[]
  const priceHistory = await getPriceHistory(id) as any[]
  const publicUrl = `/r/${property.public_slug}`

  return (
    <div>
      <Link href="/propiedades" className="inline-flex items-center gap-2 text-sm text-brand-gray hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>

      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">{property.address as string}</h1>
            <p className="text-brand-gray mt-1 text-sm">
              {property.neighborhood as string}, {property.city as string} · {property.property_type as string}
              {property.rooms ? ` · ${property.rooms} amb.` : ''}
              {property.size_m2 ? ` · ${property.size_m2} m²` : ''}
            </p>
            {property.asking_price && (
              <p className="text-lg font-semibold text-brand-pink mt-2">
                {property.currency as string} {Number(property.asking_price).toLocaleString('es-AR')}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <PropertyStatusActions propertyId={id} currentStatus={property.status as string || 'active'} currentStage={property.commercial_stage as string || 'captada'} />
            <div className="flex gap-2 w-full sm:w-auto">
              <a href={publicUrl} target="_blank" className="inline-flex items-center justify-center gap-2 text-sm text-brand-gray border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50 flex-1 sm:flex-initial">
                <ExternalLink className="w-4 h-4" /> <span className="hidden sm:inline">Ver como propietario</span><span className="sm:hidden">Ver</span>
              </a>
              <Link href={`/propiedades/${id}/reportes/nuevo`} className="inline-flex items-center justify-center gap-2 bg-brand-pink text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 flex-1 sm:flex-initial">
                <Plus className="w-4 h-4" /> Nuevo reporte
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-sm">
          <div><span className="text-brand-gray">Propietario:</span> <span className="font-medium">{property.owner_name as string}</span></div>
          {property.owner_phone && <div><span className="text-brand-gray">Tel:</span> <span className="font-medium">{property.owner_phone as string}</span></div>}
          {property.owner_email && <div><span className="text-brand-gray">Email:</span> <span className="font-medium">{property.owner_email as string}</span></div>}
        </div>
      </div>

      {/* Price History + Reports side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Price History */}
        <div className="lg:col-span-1">
          <PriceHistory
            propertyId={id}
            currentPrice={Number(property.asking_price) || 0}
            currency={(property.currency as string) || 'USD'}
            history={priceHistory}
          />
        </div>

        {/* Reports */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">Reportes</h2>
              <span className="text-sm text-brand-gray">{reports.length} reporte{reports.length !== 1 ? 's' : ''}</span>
            </div>

            {reports.length === 0 ? (
              <div className="p-12 text-center">
                <FileBarChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-brand-gray mb-3">No hay reportes para esta propiedad</p>
                <Link href={`/propiedades/${id}/reportes/nuevo`} className="text-brand-pink text-sm font-medium hover:underline">
                  Crear el primer reporte
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {reports.map((report: any) => (
                  <div key={report.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${report.status === 'published' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                        {report.status === 'published' ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <Clock className="w-5 h-5 text-yellow-600" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{report.period_label}</p>
                        <p className="text-sm text-brand-gray">
                          {formatDate(report.period_start)} - {formatDate(report.period_end)}
                          {report.creator_name && ` · por ${report.creator_name}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${report.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {report.status === 'published' ? 'Publicado' : 'Borrador'}
                      </span>
                      <DeleteReportButton reportId={report.id} propertyId={id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Documents checklist */}
        <DocumentChecklist propertyId={id} />
      </div>
    </div>
  )
}
