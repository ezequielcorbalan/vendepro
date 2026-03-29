import { getProperty, getPriceHistory } from '@/lib/actions'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Plus, FileBarChart, ExternalLink, Clock, CheckCircle2, Trash2 } from 'lucide-react'
import DeleteReportButton from '@/components/reports/DeleteReportButton'
import PropertyHeader from '@/components/properties/PropertyHeader'
import PriceHistory from '@/components/properties/PriceHistory'
import DocumentChecklist from '@/components/properties/DocumentChecklist'
import AuthorizationSection from '@/components/properties/AuthorizationSection'
import PropertyPhotos from '@/components/properties/PropertyPhotos'
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

      <PropertyHeader property={JSON.parse(JSON.stringify(property))} publicUrl={publicUrl} />

      {/* Authorization */}
      <AuthorizationSection propertyId={id} authStart={property.authorization_start as string} authDays={Number(property.authorization_days) || 180} />

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

        {/* Documents + Photos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DocumentChecklist propertyId={id} />
          <PropertyPhotos propertyId={id} />
        </div>
      </div>
    </div>
  )
}
