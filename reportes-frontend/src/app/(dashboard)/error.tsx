'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-red-500" />
      </div>
      <h2 className="text-lg font-semibold text-gray-800 mb-2">Algo salió mal</h2>
      <p className="text-sm text-gray-500 mb-4 max-w-sm">{error.message || 'Ocurrió un error inesperado.'}</p>
      <button
        onClick={reset}
        className="bg-[#ff007c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
      >
        Reintentar
      </button>
    </div>
  )
}
