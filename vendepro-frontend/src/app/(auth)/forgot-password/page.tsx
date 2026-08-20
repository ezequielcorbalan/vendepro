'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AuthCard } from '@/components/auth/AuthCard'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Text } from '@/components/ui/Typography'
import { apiFetch } from '@/lib/api'

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
      await apiFetch('auth', '/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthCard
      title="Recuperar contraseña"
      subtitle={sent ? 'Revisá tu bandeja de entrada' : 'Ingresá tu email y te enviamos las instrucciones'}
    >
      {sent ? (
        <div className="text-center space-y-4">
          <Alert tone="success">
            Si el email está registrado, vas a recibir un mensaje con las instrucciones para recuperar tu contraseña.
          </Alert>
          <Link href="/login" className="block text-primary hover:underline font-medium text-sm">
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

          <Button type="submit" loading={loading} className="w-full justify-center">
            {loading ? 'Enviando...' : 'Enviar instrucciones'}
          </Button>

          <Text size="sm" tone="muted" className="text-center">
            <Link href="/login" className="text-primary hover:underline font-medium">
              Volver al inicio de sesión
            </Link>
          </Text>
        </form>
      )}
    </AuthCard>
  )
}
