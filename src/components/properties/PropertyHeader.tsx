'use client'
import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Plus, Pencil } from 'lucide-react'
import PropertyStatusActions from './PropertyStatusActions'
import PropertyEditModal from './PropertyEditModal'

export default function PropertyHeader({ property, publicUrl }: { property: any; publicUrl: string }) {
  const [showEdit, setShowEdit] = useState(false)
  const [data, setData] = useState(property)

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">{data.address}</h1>
            <p className="text-gray-500 mt-1 text-sm">
              {data.neighborhood}, {data.city} · {data.property_type}
              {data.rooms ? ` · ${data.rooms} amb.` : ''}
              {data.size_m2 ? ` · ${data.size_m2} m²` : ''}
            </p>
            {data.asking_price && (
              <p className="text-lg font-semibold text-[#ff007c] mt-2">
                {data.currency} {Number(data.asking_price).toLocaleString('es-AR')}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <PropertyStatusActions propertyId={data.id} currentStatus={data.status || 'active'} currentStage={data.commercial_stage || 'captada'} />
            <div className="flex gap-2 w-full sm:w-auto">
              <button onClick={() => setShowEdit(true)}
                className="inline-flex items-center justify-center gap-2 text-sm text-gray-600 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50">
                <Pencil className="w-4 h-4" /> <span className="hidden sm:inline">Editar</span>
              </button>
              <a href={publicUrl} target="_blank" className="inline-flex items-center justify-center gap-2 text-sm text-gray-500 border border-gray-300 px-3 py-2 rounded-lg hover:bg-gray-50">
                <ExternalLink className="w-4 h-4" /> <span className="hidden sm:inline">Ver público</span>
              </a>
              <Link href={`/propiedades/${data.id}/reportes/nuevo`} className="inline-flex items-center justify-center gap-2 bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
                <Plus className="w-4 h-4" /> Reporte
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-sm">
          <div><span className="text-gray-500">Propietario:</span> <span className="font-medium">{data.owner_name}</span></div>
          {data.owner_phone && <div><span className="text-gray-500">Tel:</span> <a href={`tel:${data.owner_phone}`} className="font-medium text-blue-600">{data.owner_phone}</a></div>}
          {data.owner_email && <div><span className="text-gray-500">Email:</span> <span className="font-medium">{data.owner_email}</span></div>}
          {data.lead_id && (
            <div><span className="text-gray-500">Lead origen:</span> <Link href={`/leads/${data.lead_id}`} className="font-medium text-[#ff007c] hover:underline">Ver lead →</Link></div>
          )}
        </div>
      </div>

      {showEdit && (
        <PropertyEditModal
          property={data}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); window.location.reload() }}
        />
      )}
    </>
  )
}
