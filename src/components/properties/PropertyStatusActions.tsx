'use client'

import { useState } from 'react'
import { Archive, CheckCircle2, Pause, DollarSign } from 'lucide-react'

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: 'Activa', color: 'text-green-700', bg: 'bg-green-100' },
  sold: { label: 'Vendida', color: 'text-pink-700', bg: 'bg-pink-100' },
  suspended: { label: 'Pausada', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  archived: { label: 'Archivada', color: 'text-gray-500', bg: 'bg-gray-100' },
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

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === status) return
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
        {status !== 'suspended' && (
          <button
            onClick={() => handleStatusChange('suspended')}
            disabled={loading}
            className="p-1.5 rounded-lg text-yellow-600 hover:bg-yellow-50 transition-colors"
            title="Pausar"
          >
            <Pause className="w-4 h-4" />
          </button>
        )}
        {status !== 'archived' && (
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
  )
}
