'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'

export default function DeleteReportButton({ reportId, propertyId }: { reportId: string; propertyId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json() as any
        alert(data.error || 'Error al eliminar')
      }
    } catch {
      alert('Error al eliminar el reporte')
    } finally {
      setDeleting(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 disabled:opacity-50"
        >
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirmar'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-500 px-2 py-1 rounded hover:bg-gray-100"
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
      title="Eliminar reporte"
    >
      <Trash2 className="w-4 h-4" />
    </button>
  )
}
