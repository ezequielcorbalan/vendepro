'use client'
import { useState, useEffect } from 'react'
import { FileText, Plus, Check, Clock, AlertTriangle, X, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

const DEFAULT_DOCS = [
  { name: 'Escritura / T\u00edtulo de propiedad', type: 'legal', critical: true },
  { name: 'Plano de mensura', type: 'legal', critical: true },
  { name: 'Libre deuda municipal', type: 'impuestos', critical: true },
  { name: 'Libre deuda AYSA', type: 'impuestos', critical: false },
  { name: 'Libre deuda Edesur/Edenor', type: 'impuestos', critical: false },
  { name: 'Libre deuda expensas', type: 'impuestos', critical: true },
  { name: 'Informe de dominio', type: 'legal', critical: true },
  { name: 'Informe de inhibiciones', type: 'legal', critical: true },
  { name: 'DNI propietario/s', type: 'personal', critical: true },
  { name: 'Reglamento de copropiedad', type: 'legal', critical: false },
  { name: 'Certificado de apto cr\u00e9dito', type: 'financiero', critical: false },
  { name: 'Fotos profesionales', type: 'comercial', critical: false },
]

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  pendiente: { label: 'Pendiente', icon: Clock, color: 'text-gray-400 bg-gray-50' },
  en_gestion: { label: 'En gesti\u00f3n', icon: Loader2, color: 'text-yellow-600 bg-yellow-50' },
  completado: { label: 'Listo', icon: Check, color: 'text-green-600 bg-green-50' },
  no_aplica: { label: 'No aplica', icon: X, color: 'text-gray-300 bg-gray-50' },
}

export default function DocumentChecklist({ propertyId }: { propertyId: string }) {
  const { toast } = useToast()
  const [docs, setDocs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [initializing, setInitializing] = useState(false)

  const loadDocs = () => {
    fetch(`/api/documents?property_id=${propertyId}`)
      .then(r => (r.json()) as Promise<any>)
      .then(d => { setDocs(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  useEffect(() => { loadDocs() }, [propertyId])

  // Initialize default docs for this property
  const initializeDefaults = async () => {
    setInitializing(true)
    try {
      for (let i = 0; i < DEFAULT_DOCS.length; i++) {
        const doc = DEFAULT_DOCS[i]
        await fetch('/api/documents', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            property_id: propertyId,
            document_name: doc.name,
            document_type: doc.type,
            status: 'pendiente',
            sort_order: i,
          }),
        })
      }
      toast(`${DEFAULT_DOCS.length} documentos inicializados`, 'success')
      loadDocs()
    } catch { toast('Error', 'error') }
    finally { setInitializing(false) }
  }

  const updateStatus = async (docId: string, newStatus: string) => {
    const doc = docs.find(d => d.id === docId)
    if (!doc) return
    // Optimistic update
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: newStatus } : d))
    try {
      await fetch('/api/documents', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docId, document_name: doc.document_name, document_type: doc.document_type, status: newStatus, sort_order: doc.sort_order }),
      })
    } catch {
      loadDocs() // revert on error
    }
  }

  const completed = docs.filter(d => d.status === 'completado').length
  const critical = docs.filter(d => d.is_critical && d.status !== 'completado' && d.status !== 'no_aplica')
  const total = docs.filter(d => d.status !== 'no_aplica').length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0

  if (loading) return <div className="animate-pulse h-40 bg-gray-100 rounded-xl" />

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800 flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-500" /> Documentaci&oacute;n
        </h2>
        {docs.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-bold text-gray-600">{pct}%</span>
          </div>
        )}
      </div>

      {docs.length === 0 ? (
        <div className="text-center py-6">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-3">Sin documentos cargados</p>
          <button onClick={initializeDefaults} disabled={initializing}
            className="bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5">
            {initializing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Cargar checklist por defecto
          </button>
        </div>
      ) : (
        <>
          {critical.length > 0 && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {critical.length} documento{critical.length > 1 ? 's' : ''} cr&iacute;tico{critical.length > 1 ? 's' : ''} pendiente{critical.length > 1 ? 's' : ''}
            </div>
          )}
          <div className="space-y-1">
            {docs.map(doc => {
              const cfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.pendiente
              const Icon = cfg.icon
              return (
                <div key={doc.id} className={`flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-50 group ${doc.status === 'completado' ? 'opacity-60' : ''}`}>
                  <button onClick={() => updateStatus(doc.id, doc.status === 'completado' ? 'pendiente' : 'completado')}
                    className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${doc.status === 'completado' ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-green-400'}`}>
                    {doc.status === 'completado' && <Check className="w-3 h-3" />}
                  </button>
                  <span className={`text-sm flex-1 ${doc.status === 'completado' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {doc.document_name || doc.doc_type}
                    {doc.is_critical && doc.status !== 'completado' && <span className="text-red-500 ml-1">*</span>}
                  </span>
                  <select value={doc.status} onChange={e => updateStatus(doc.id, e.target.value)}
                    className="text-[10px] bg-transparent border-0 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                    <option value="pendiente">Pendiente</option>
                    <option value="en_gestion">En gesti&oacute;n</option>
                    <option value="completado">Listo</option>
                    <option value="no_aplica">No aplica</option>
                  </select>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
