'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { AuthCard } from '@/components/auth/AuthCard'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Text } from '@/components/ui/Typography'
import { apiFetch } from '@/lib/api'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) setError('Link inválido. Solicitá un nuevo link de recuperación.')
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }

    setLoading(true)
    setError('')

    try {
      const res = await apiFetch('auth', '/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      })

      const data = (await res.json()) as any

      if (!res.ok) {
        setError(data.error ?? 'Error al restablecer la contraseña')
        return
      }

      setSuccess(true)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <Alert tone="success">
          ¡Contraseña actualizada correctamente! Ya podés ingresar con tu nueva contraseña.
        </Alert>
        <Link
          href="/login"
          className="block w-full text-center bg-primary hover:bg-primary-hover text-white text-sm font-medium py-2 rounded-control transition-colors"
        >
          Ir al inicio de sesión
        </Link>
      </div>
    )
  }

  const isInvalidToken = error.includes('inválido') || error.includes('expirado')

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert tone="danger">
          {error}
          {isInvalidToken && (
            <>
              {' '}
              <Link href="/forgot-password" className="underline font-medium">
                Solicitá un nuevo link
              </Link>
            </>
          )}
        </Alert>
      )}

      <Field label="Nueva contraseña">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          disabled={!token}
          placeholder="Mínimo 8 caracteres"
        />
      </Field>

      <Field label="Repetir contraseña">
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          disabled={!token}
          placeholder="Repetí la contraseña"
        />
      </Field>

      <Button type="submit" loading={loading} disabled={!token} className="w-full justify-center">
        {loading ? 'Guardando...' : 'Guardar contraseña'}
      </Button>

      <Text size="sm" tone="muted" className="text-center">
        <Link href="/login" className="text-primary hover:underline font-medium">
          Volver al inicio de sesión
        </Link>
      </Text>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthCard title="Nueva contraseña" subtitle="Elegí una contraseña segura para tu cuenta">
      <Suspense fallback={<Text size="sm" tone="muted" className="text-center">Cargando...</Text>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthCard>
  )
}
