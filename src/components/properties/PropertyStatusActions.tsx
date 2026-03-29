'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Archive, CheckCircle2, Pause, DollarSign, XCircle, Trash2, ArrowRight, ChevronDown } from 'lucide-react'
import { PROPERTY_STAGES, PROPERTY_STAGE_KEYS, type PropertyStage } from '@/lib/crm-config'
import { useToast } from '@/components/ui/Toast'

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Activa', color: 'text-green-700', bg: 'bg-green-100' },
  sold: { label: 'Vendida', color: 'text-pink-700', bg: 'bg-pink-100' },
  suspended: { label: 'Pausada', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  archived: { label: 'Archivada', color: 'text-gray-500', bg: 'bg-gray-100' },
  inactive: { label: 'Dada de baja', color: 'text-red-700', bg: 'bg-red-100' },
}

export default function PropertyStatusActions({
  propertyId,
  currentStatus,
  currentStage,
}: {
  propertyId: string
  currentStatus: string
  currentStage?: string
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(currentStatus)
  const [stage, setStage] = useState<string>(currentStage || 'captada')
  const [showConfirm, setShowConfirm] = useState<string | null>(null)
  const [showStageDropdown, setShowStageDropdown] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === status) return
    if ((newStatus === 'inactive' || newStatus === 'sold') && showConfirm !== newStatus) {
      setShowConfirm(newStatus)
      return
    }
    setShowConfirm(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/properties/${propertyId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) {
        setStatus(newStatus)
        toast(`Propiedad ${statusConfig[newStatus]?.label || newStatus}`, 'success')
      }
    } finally { setLoading(false) }
  }

  const handleStageChange = async (newStage: PropertyStage) => {
    if (newStage === stage) { setShowStageDropdown(false); return }
    setLoading(true)
    setShowStageDropdown(false)
    try {
      const res = await fetch('/api/properties', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: propertyId, commercial_stage: newStage }),
      })
      if (res.ok) {
        setStage(newStage)
        toast(`Etapa → ${PROPERTY_STAGES[newStage].label}`, 'success')
      }
    } finally { setLoading(false) }
  }

  const handleDelete = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/properties?id=${propertyId}`, { method: 'DELETE' })
      if (res.ok) {
        toast('Propiedad eliminada', 'warning')
        router.push('/propiedades')
      } else {
        toast('Error al eliminar', 'error')
      }
    } finally { setLoading(false); setShowDeleteConfirm(false) }
  }

  const cfg = statusConfig[status] || statusConfig.active
  const stageCfg = PROPERTY_STAGES[stage as PropertyStage] || PROPERTY_STAGES.captada

  return (
    <div className="space-y-3">
      {/* Status + Pipeline Stage */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status badge */}
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>

        {/* Status action icons */}
        <div className="flex gap-0.5">
          {status !== 'active' && (
            <button onClick={() => handleStatusChange('active')} disabled={loading}
              className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors" title="Activar">
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          {status !== 'sold' && (
            <button onClick={() => handleStatusChange('sold')} disabled={loading}
              className="p-1.5 rounded-lg text-pink-600 hover:bg-pink-50 transition-colors" title="Marcar vendida">
              <DollarSign className="w-4 h-4" />
            </button>
          )}
          {status !== 'suspended' && status !== 'inactive' && (
            <button onClick={() => handleStatusChange('suspended')} disabled={loading}
              className="p-1.5 rounded-lg text-yellow-600 hover:bg-yellow-50 transition-colors" title="Pausar">
              <Pause className="w-4 h-4" />
            </button>
          )}
          {status !== 'inactive' && (
            <button onClick={() => handleStatusChange('inactive')} disabled={loading}
              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors" title="Dar de baja">
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Pipeline stage selector */}
        <div className="relative">
          <button
            onClick={() => setShowStageDropdown(!showStageDropdown)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${stageCfg.color} border-current/20 hover:opacity-80`}
          >
            {stageCfg.label} <ChevronDown className="w-3 h-3" />
          </button>
          {showStageDropdown && (
            <div className="absolute top-full mt-1 right-0 bg-white rounded-xl shadow-xl border border-gray-200 z-50 py-1 min-w-[180px]">
              {PROPERTY_STAGE_KEYS.map(s => {
                const sc = PROPERTY_STAGES[s]
                const isCurrent = s === stage
                return (
                  <button key={s} onClick={() => handleStageChange(s)} disabled={loading}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 transition-colors ${
                      isCurrent ? 'bg-gray-50 font-bold' : 'hover:bg-gray-50'
                    }`}>
                    <span className={`w-2 h-2 rounded-full ${sc.color.split(' ')[0].replace('text-', 'bg-')}`} />
                    {sc.label}
                    {isCurrent && <CheckCircle2 className="w-3 h-3 text-green-500 ml-auto" />}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Delete */}
        <button onClick={() => setShowDeleteConfirm(true)} disabled={loading}
          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors ml-auto" title="Eliminar propiedad">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Confirm status change */}
      {showConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          <p className="text-red-700 mb-2">
            {showConfirm === 'inactive' ? '¿Dar de baja esta propiedad?' : '¿Marcar como vendida?'}
          </p>
          <div className="flex gap-2">
            <button onClick={() => handleStatusChange(showConfirm)} disabled={loading}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700">Confirmar</button>
            <button onClick={() => setShowConfirm(null)}
              className="px-3 py-1 bg-white text-gray-600 text-xs rounded-lg border hover:bg-gray-50">Cancelar</button>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {showDeleteConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          <p className="text-red-700 mb-2 font-medium">¿Eliminar esta propiedad permanentemente?</p>
          <p className="text-red-600 text-xs mb-2">Esta acción no se puede deshacer. Se eliminarán también los reportes asociados.</p>
          <div className="flex gap-2">
            <button onClick={handleDelete} disabled={loading}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700">
              {loading ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
            <button onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1 bg-white text-gray-600 text-xs rounded-lg border hover:bg-gray-50">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}
