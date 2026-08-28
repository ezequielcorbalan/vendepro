'use client'

import { useState } from 'react'
import { MailX, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function UnsubscribeClient({
  token,
  email,
  apiPublic,
}: {
  token: string
  email: string
  apiPublic: string
}) {
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle')

  async function confirm() {
    setStatus('working')
    try {
      const res = await fetch(`${apiPublic}/public/unsubscribe/${encodeURIComponent(token)}`, { method: 'POST' })
      const data = (await res.json()) as any
      setStatus(res.ok && data.ok ? 'done' : 'error')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        {status === 'done' ? (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-ink mb-2">Listo, te diste de baja</h1>
            <p className="text-sm text-gray-500">
              <span className="font-medium text-gray-700">{email}</span> no va a recibir más emails
              de marketing. Podés cerrar esta página.
            </p>
          </>
        ) : status === 'error' ? (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-ink mb-2">No pudimos procesar la baja</h1>
            <p className="text-sm text-gray-500 mb-4">Probá de nuevo en unos minutos.</p>
            <Button variant="neutral" onClick={confirm}>
              Reintentar
            </Button>
          </>
        ) : (
          <>
            <MailX className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h1 className="text-lg font-semibold text-ink mb-2">Cancelar suscripción</h1>
            <p className="text-sm text-gray-500 mb-6">
              ¿Querés dejar de recibir emails de marketing en{' '}
              <span className="font-medium text-gray-700">{email}</span>?
            </p>
            <Button variant="neutral" size="lg" loading={status === 'working'} onClick={confirm}>
              Sí, darme de baja
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
