'use client'

import { useState } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Heading, Text } from '@/components/ui/Typography'
import { Alert } from '@/components/ui/Alert'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await apiFetch('auth', '/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })

      // apiFetch no tira ante un non-2xx: devuelve la Response. Sin este chequeo
      // un 503 (proveedor de emails sin configurar) mostraba igual "revisá tu
      // bandeja" y el usuario esperaba un mail que nunca iba a salir.
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as any
        setError(data.error ?? 'No pudimos enviar el email. Intentá de nuevo en unos minutos.')
        return
      }

      setSent(true)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/brand/logo-horizontal.png" alt="VendéPro" className="h-12 sm:h-16 mx-auto mb-3" />
          <Heading level={2}>Recuperar contraseña</Heading>
          <Text size="sm" tone="muted" className="mt-1">
            {sent
              ? 'Revisá tu bandeja de entrada'
              : 'Ingresá tu email y te enviamos las instrucciones'}
          </Text>
        </div>

        {sent ? (
          <div className="text-center space-y-4">
            <Alert tone="success" className="text-left">
              Si el email está registrado, vas a recibir un mensaje con las instrucciones para recuperar tu contraseña.
            </Alert>
            <Link
              href="/login"
              className="block w-full text-center text-primary hover:underline font-medium text-sm mt-2"
            >
              Volver al inicio de sesión
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <Alert tone="danger">{error}</Alert>}

            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="tu@email.com"
              />
            </Field>

            <Button type="submit" size="lg" fullWidth loading={loading}>
              {loading ? 'Enviando…' : 'Enviar instrucciones'}
            </Button>

            <Text size="sm" tone="muted" className="text-center">
              <Link href="/login" className="text-primary hover:underline font-medium">
                Volver al inicio de sesión
              </Link>
            </Text>
          </form>
        )}
      </div>
    </div>
  )
}
