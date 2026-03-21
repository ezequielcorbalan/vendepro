'use client'

import { useState } from 'react'
import { Archive, CheckCircle2, Pause, DollarSign, XCircle } from 'lucide-react'

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
}: {
  propertyId: string
  currentStatus: string
}) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(currentStatus)
  const [showConfirm, setShowConfirm] = useState<string | null>(null)

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === status) return
    // Confirm for destructive actions
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
      }
    } finally {
      setLoading(false)
    }
  }

  const cfg = statusConfig[status] || statusConfig.active

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.color}`}>
          {cfg.label}
        </span>
        <div className="flex gap-1">
          {status !== 'active' && (
            <button
              onClick={() => handleStatusChange('active')}
              disabled={loading}
              className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition-colors"
              title="Activar"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          {status !== 'sold' && (
            <button
              onClick={() => handleStatusChange('sold')}
              disabled={loading}
              className="p-1.5 rounded-lg text-pink-600 hover:bg-pink-50 transition-colors"
              title="Marcar como vendida"
            >
              <DollarSign className="w-4 h-4" />
            </button>
          )}
          {status !== 'suspended' && status !== 'inactive' && (
            <button
              onClick={() => handleStatusChange('suspended')}
              disabled={loading}
              className="p-1.5 rounded-lg text-yellow-600 hover:bg-yellow-50 transition-colors"
              title="Pausar"
            >
              <Pause className="w-4 h-4" />
            </button>
          )}
          {status !== 'inactive' && (
            <button
              onClick={() => handleStatusChange('inactive')}
              disabled={loading}
              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
              title="Dar de baja"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
          {status !== 'archived' && status !== 'inactive' && (
            <button
              onClick={() => handleStatusChange('archived')}
              disabled={loading}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              title="Archivar"
            >
              <Archive className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {showConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
          <p className="text-red-700 mb-2">
            {showConfirm === 'inactive'
              ? '¿Confirmar dar de baja esta propiedad?'
              : '¿Confirmar marcar como vendida?'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleStatusChange(showConfirm)}
              disabled={loading}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700"
            >
              Confirmar
            </button>
            <button
              onClick={() => setShowConfirm(null)}
              className="px-3 py-1 bg-white text-gray-600 text-xs rounded-lg border hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
