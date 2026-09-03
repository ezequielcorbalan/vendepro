'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Heading, Text } from '@/components/ui/Typography'
import { Alert } from '@/components/ui/Alert'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
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
        <Alert tone="success" className="text-left">
          ¡Contraseña actualizada correctamente! Ya podés ingresar con tu nueva contraseña.
        </Alert>
        <Button size="lg" fullWidth onClick={() => router.push('/login')}>
          Ir al inicio de sesión
        </Button>
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
            <span>
              {' '}
              <Link href="/forgot-password" className="underline font-medium">
                Solicitá un nuevo link
              </Link>
            </span>
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

      <Button type="submit" size="lg" fullWidth loading={loading} disabled={!token}>
        {loading ? 'Guardando…' : 'Guardar contraseña'}
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/brand/logo-horizontal.png" alt="VendéPro" className="h-12 sm:h-16 mx-auto mb-3" />
          <Heading level={2}>Nueva contraseña</Heading>
          <Text size="sm" tone="muted" className="mt-1">Elegí una contraseña segura para tu cuenta</Text>
        </div>
        <Suspense fallback={<div className="text-center text-sm text-gray-400">Cargando...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
