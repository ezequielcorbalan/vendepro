'use client'

import { useState, useEffect } from 'react'
import { FileCheck2, Check, X, Circle } from 'lucide-react'
import { apiFetch } from '@/lib/api'

type DocState = 'done' | 'na' | 'pending'

const DEFAULT_DOCS: Array<{ key: string; label: string }> = [
  { key: 'auth_signed', label: 'Autorización de venta firmada' },
  { key: 'title', label: 'Título de propiedad' },
  { key: 'escritura', label: 'Escritura' },
  { key: 'plano_mensura', label: 'Plano de mensura' },
  { key: 'reglamento', label: 'Reglamento de copropiedad' },
  { key: 'libre_expensas', label: 'Libre deuda de expensas' },
  { key: 'libre_municipal', label: 'Libre deuda municipal (ABL)' },
  { key: 'libre_aysa', label: 'Libre deuda de AySA' },
  { key: 'libre_inmobiliario', label: 'Libre deuda de impuesto inmobiliario' },
  { key: 'informe_dominio', label: 'Informe de dominio (30 días)' },
  { key: 'informe_inhibicion', label: 'Informe de inhibición' },
  { key: 'dni_propietario', label: 'DNI del propietario' },
  { key: 'constancia_cuit', label: 'Constancia CUIT/CUIL' },
  { key: 'cert_matrimonio', label: 'Certificado de matrimonio (si aplica)' },
  { key: 'fotos_profesionales', label: 'Fotos profesionales' },
  { key: 'plano_actualizado', label: 'Plano actualizado' },
]

interface Props {
  propertyId: string
  docStatusJson: string | null
  capturedAt: string | null
}

function parseStatus(raw: string | null): Record<string, DocState> {
  if (!raw) return {}
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return parsed || {}
  } catch { return {} }
}

export default function DocChecklistWidget({ propertyId, docStatusJson, capturedAt }: Props) {
  const [status, setStatus] = useState<Record<string, DocState>>(() => parseStatus(docStatusJson))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setStatus(parseStatus(docStatusJson))
  }, [docStatusJson])

  const totalItems = DEFAULT_DOCS.length
  const resolvedItems = DEFAULT_DOCS.filter(d => {
    const s = status[d.key]
    return s === 'done' || s === 'na'
  }).length
  const progressPct = Math.round((resolvedItems / totalItems) * 100)

  const daysSinceCapture = capturedAt
    ? Math.floor((Date.now() - new Date(capturedAt).getTime()) / 86400000)
    : null
  const daysRemaining = daysSinceCapture !== null ? Math.max(0, 15 - daysSinceCapture) : null

  async function updateStatus(key: string, newState: DocState) {
    const next = { ...status, [key]: newState }
    setStatus(next)
    setSaving(true)
    try {
      await apiFetch('properties', `/properties/${propertyId}`, {
        method: 'PUT',
        body: JSON.stringify({ doc_status_json: JSON.stringify(next) }),
      })
    } catch { /* noop */ }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#ff007c] to-[#ff8017] flex items-center justify-center shadow-sm">
            <FileCheck2 className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Documentación</h2>
            <p className="text-xs text-gray-500">{resolvedItems} de {totalItems} resueltos</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold bg-gradient-to-br from-[#ff007c] to-[#ff8017] bg-clip-text text-transparent">
            {progressPct}%
          </p>
        </div>
      </div>

      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-[#ff007c] to-[#ff8017] transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {daysRemaining !== null && daysRemaining > 0 && resolvedItems < totalItems && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mb-3">
          <b>{daysRemaining} días</b> para completar · Meta: 15 días desde captación
        </div>
      )}

      <div className="space-y-1">
        {DEFAULT_DOCS.map(doc => {
          const s = status[doc.key] ?? 'pending'
          return (
            <div key={doc.key} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50">
              <span className={`text-sm flex-1 ${
                s === 'done' ? 'text-gray-700' :
                s === 'na' ? 'text-gray-400 line-through' :
                'text-gray-700'
              }`}>
                {doc.label}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => updateStatus(doc.key, s === 'done' ? 'pending' : 'done')}
                  title="Tengo el documento"
                  className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                    s === 'done' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-green-100'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => updateStatus(doc.key, s === 'na' ? 'pending' : 'na')}
                  title="No aplica"
                  className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                    s === 'na' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400 hover:bg-red-100'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => updateStatus(doc.key, 'pending')}
                  title="Pendiente"
                  className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${
                    s === 'pending' ? 'bg-gray-300 text-gray-600' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <Circle className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {saving && <p className="text-xs text-gray-400 text-center mt-2">Guardando...</p>}
    </div>
  )
}
