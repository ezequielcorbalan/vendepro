'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Heading, Text } from '@/components/ui/Typography'
import { Button } from '@/components/ui/Button'

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
      <div className="w-14 h-14 rounded-card bg-danger/10 text-danger grid place-items-center mb-3.5">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <Heading level={4}>Algo salió mal</Heading>
      <Text tone="muted" className="mt-1 max-w-sm">{error.message || 'Ocurrió un error inesperado.'}</Text>
      <Button onClick={reset} className="mt-4">Reintentar</Button>
    </div>
  )
}
