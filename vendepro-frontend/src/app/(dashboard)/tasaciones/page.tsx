'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, ClipboardList, MapPin, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'

const statusLabels: Record<string, { label: string; color: string }> = {
  draft: { label: 'Borrador', color: 'bg-gray-100 text-gray-700' },
  generated: { label: 'Generada', color: 'bg-blue-100 text-blue-700' },
  sent: { label: 'Enviada', color: 'bg-green-100 text-green-700' },
}

export default function TasacionesPage() {
  const { toast } = useToast()
  const [appraisals, setAppraisals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  function loadAppraisals() {
    apiFetch('properties', '/appraisals')
      .then(r => r.json() as Promise<any>)
      .then(d => { setAppraisals(Array.isArray(d) ? d : (d.appraisals || [])); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadAppraisals() }, [])

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta tasación?')) return
    try {
      await apiFetch('properties', `/appraisals?id=${id}`, { method: 'DELETE' })
      toast('Tasación eliminada', 'warning')
      loadAppraisals()
    } catch { toast('Error al eliminar', 'error') }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Tasaciones</h1>
          <p className="text-gray-500 text-sm mt-1">Tasaciones profesionales para propietarios</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/configuracion/tasacion" className="border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
            Configurar
          </Link>
          <Link href="/prefactibilidades/nueva" className="border border-orange-300 bg-orange-50 text-orange-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-100 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Prefactibilidad
          </Link>
          <Link href="/tasaciones/nueva" className="bg-[#ff007c] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nueva tasación
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-xl" />)}
        </div>
      ) : appraisals.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 sm:p-12 text-center">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-600 mb-2">Sin tasaciones</h2>
          <p className="text-gray-400 text-sm mb-6">Creá tu primera tasación</p>
          <Link href="/tasaciones/nueva" className="inline-flex items-center gap-2 bg-[#ff007c] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" /> Crear tasación
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {appraisals.map((a: any) => {
            const st = statusLabels[a.status] || statusLabels.draft
            return (
              <div key={a.id} className="bg-white rounded-xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <Link href={`/tasaciones/${a.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-800 truncate">{a.property_address}</h3>
                    <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs sm:text-sm text-gray-500">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {a.neighborhood}</span>
                    {a.suggested_price && <span className="font-medium text-[#ff007c]">USD {Number(a.suggested_price).toLocaleString('es-AR')}</span>}
                    <span>{formatDate(a.created_at)}</span>
                  </div>
                  {a.agent_name && <p className="text-xs text-gray-400 mt-1">Agente: {a.agent_name}</p>}
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  {a.public_slug && (
                    <a href={`/t/${a.public_slug}`} target="_blank" rel="noreferrer"
                      className="p-2 border rounded-lg hover:bg-gray-50 text-gray-500" title="Ver pública">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <Link href={`/tasaciones/${a.id}`} className="p-2 border rounded-lg hover:bg-gray-50 text-gray-500" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button onClick={() => handleDelete(a.id)} className="p-2 border rounded-lg hover:bg-red-50 hover:border-red-200 text-gray-400 hover:text-red-500" title="Eliminar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
