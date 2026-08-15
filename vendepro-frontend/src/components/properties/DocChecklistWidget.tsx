'use client'

import { useState, useEffect } from 'react'
import { FileCheck2, Check, X, Circle, FolderOpen, Plus, ExternalLink, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

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

interface DocData {
  status: Record<string, DocState>
  cloud_url?: string
  custom?: Array<{ key: string; label: string }>
  hidden?: string[]
}

interface Props {
  propertyId: string
  docStatusJson: string | null
  capturedAt: string | null
}

function parseData(raw: string | null): DocData {
  if (!raw) return { status: {} }
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed && typeof parsed === 'object') {
      // New format
      if ('status' in parsed) {
        return {
          status: parsed.status || {},
          cloud_url: parsed.cloud_url || '',
          custom: Array.isArray(parsed.custom) ? parsed.custom : [],
          hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
        }
      }
      // Legacy format: flat status map
      return { status: parsed }
    }
    return { status: {} }
  } catch { return { status: {} } }
}

export default function DocChecklistWidget({ propertyId, docStatusJson, capturedAt }: Props) {
  const [data, setData] = useState<DocData>(() => parseData(docStatusJson))
  const [saving, setSaving] = useState(false)
  const [showCloudInput, setShowCloudInput] = useState(false)
  const [cloudInput, setCloudInput] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customInput, setCustomInput] = useState('')

  useEffect(() => {
    setData(parseData(docStatusJson))
  }, [docStatusJson])

  const customDocs = data.custom ?? []
  const hidden = data.hidden ?? []
  const visibleDefaults = DEFAULT_DOCS.filter(d => !hidden.includes(d.key))
  const allDocs = [...visibleDefaults, ...customDocs]
  const totalItems = allDocs.length
  const resolvedItems = allDocs.filter(d => {
    const s = data.status[d.key]
    return s === 'done' || s === 'na'
  }).length
  const progressPct = totalItems > 0 ? Math.round((resolvedItems / totalItems) * 100) : 0

  const daysSinceCapture = capturedAt
    ? Math.floor((Date.now() - new Date(capturedAt).getTime()) / 86400000)
    : null
  const daysRemaining = daysSinceCapture !== null ? Math.max(0, 15 - daysSinceCapture) : null

  async function persist(next: DocData) {
    setData(next)
    setSaving(true)
    try {
      await apiFetch('properties', `/properties/${propertyId}`, {
        method: 'PUT',
        body: JSON.stringify({ doc_status_json: JSON.stringify(next) }),
      })
    } catch { /* noop */ }
    setSaving(false)
  }

  function updateStatus(key: string, newState: DocState) {
    persist({ ...data, status: { ...data.status, [key]: newState } })
  }

  function saveCloudUrl() {
    persist({ ...data, cloud_url: cloudInput.trim() })
    setShowCloudInput(false)
  }

  function addCustomDoc() {
    const label = customInput.trim()
    if (!label) return
    const key = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    persist({
      ...data,
      custom: [...customDocs, { key, label }],
    })
    setCustomInput('')
    setShowCustomInput(false)
  }

  function removeCustomDoc(key: string) {
    const newStatus = { ...data.status }
    delete newStatus[key]
    persist({
      ...data,
      status: newStatus,
      custom: customDocs.filter(c => c.key !== key),
    })
  }

  function hideDefaultDoc(key: string) {
    const newStatus = { ...data.status }
    delete newStatus[key]
    persist({
      ...data,
      status: newStatus,
      hidden: [...hidden, key],
    })
  }

  function restoreAllHidden() {
    persist({ ...data, hidden: [] })
  }

  return (
    <div className="bg-white rounded-card border border-gray-200 shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-pink to-brand-orange flex items-center justify-center">
            <FileCheck2 className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-ink">Documentación</h2>
            <p className="text-xs text-gray-500">{resolvedItems} de {totalItems} resueltos</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold bg-gradient-to-br from-brand-pink to-brand-orange bg-clip-text text-transparent">
            {progressPct}%
          </p>
        </div>
      </div>

      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-brand-pink to-brand-orange transition-all"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {daysRemaining !== null && daysRemaining > 0 && resolvedItems < totalItems && (
        <div className="text-xs text-warning bg-warning/10 border border-warning/30 rounded-control px-3 py-1.5 mb-3">
          <b>{daysRemaining} días</b> para completar · Meta: 15 días desde captación
        </div>
      )}

      {/* Cloud folder link */}
      <div className="mb-3">
        {data.cloud_url && !showCloudInput ? (
          <div className="flex items-center justify-between bg-gradient-to-br from-brand-pink/5 to-brand-orange/5 border border-brand-pink/20 rounded-lg px-3 py-2">
            <a
              href={data.cloud_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-brand-pink font-medium hover:underline truncate"
            >
              <FolderOpen className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Abrir carpeta de documentos</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
            </a>
            <button
              onClick={() => { setCloudInput(data.cloud_url || ''); setShowCloudInput(true) }}
              className="text-xs text-gray-400 hover:text-gray-600 ml-2"
            >
              Editar
            </button>
          </div>
        ) : showCloudInput ? (
          <div className="flex gap-2">
            <Input
              type="url"
              value={cloudInput}
              onChange={e => setCloudInput(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="flex-1"
            />
            <Button size="sm" onClick={saveCloudUrl}>Guardar</Button>
            <Button
              variant="ghost" size="icon" aria-label="Cancelar"
              onClick={() => { setShowCloudInput(false); setCloudInput('') }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <button
            onClick={() => { setCloudInput(''); setShowCloudInput(true) }}
            className="flex items-center gap-2 text-xs text-gray-500 hover:text-brand-pink border border-dashed border-gray-300 hover:border-brand-pink rounded-lg px-3 py-2 w-full transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5" /> Agregar link a carpeta en la nube (Drive, OneDrive...)
          </button>
        )}
      </div>

      <div className="space-y-1">
        {allDocs.map(doc => {
          const s = data.status[doc.key] ?? 'pending'
          const isCustom = customDocs.some(c => c.key === doc.key)
          return (
            <div key={doc.key} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50 group">
              <span className={`text-sm flex-1 ${
                s === 'done' ? 'text-gray-700' :
                s === 'na' ? 'text-gray-400 line-through' :
                'text-gray-700'
              }`}>
                {doc.label}
                {isCustom && <span className="ml-1 text-[10px] text-gray-400">(custom)</span>}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => isCustom ? removeCustomDoc(doc.key) : hideDefaultDoc(doc.key)}
                  title="Eliminar item"
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity p-1"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
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

      {/* Restaurar items eliminados */}
      {hidden.length > 0 && (
        <div className="mt-2">
          <button
            onClick={restoreAllHidden}
            className="text-xs text-gray-400 hover:text-brand-pink hover:underline"
          >
            Restaurar {hidden.length} {hidden.length === 1 ? 'item eliminado' : 'items eliminados'}
          </button>
        </div>
      )}

      {/* Add custom item */}
      <div className="mt-3 pt-3 border-t border-gray-100">
        {showCustomInput ? (
          <div className="flex gap-2">
            <Input
              type="text"
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCustomDoc() }}
              autoFocus
              placeholder="Ej: Aprobación banco hipotecario"
              className="flex-1"
            />
            <Button size="sm" onClick={addCustomDoc} disabled={!customInput.trim()}>Agregar</Button>
            <Button
              variant="ghost" size="icon" aria-label="Cancelar"
              onClick={() => { setShowCustomInput(false); setCustomInput('') }}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setShowCustomInput(true)}
            className="flex items-center gap-1 text-xs text-brand-pink font-medium hover:underline"
          >
            <Plus className="w-3 h-3" /> Agregar documento custom
          </button>
        )}
      </div>

      {saving && <p className="text-xs text-gray-400 text-center mt-2">Guardando...</p>}
    </div>
  )
}
