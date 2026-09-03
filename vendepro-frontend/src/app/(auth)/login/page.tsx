'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Input'
import { Heading, Text } from '@/components/ui/Typography'
import { Alert } from '@/components/ui/Alert'
import { apiFetch, setToken } from '@/lib/api'
import { setCurrentUser } from '@/lib/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await apiFetch('auth', '/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        setError('Email o contraseña incorrectos')
        setLoading(false)
        return
      }

      const data = (await res.json()) as any

      if (data.token && data.user) {
        // Store token in localStorage and as cookie for middleware
        setToken(data.token)
        document.cookie = `vendepro_token=${data.token}; path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`

        // Store user info
        setCurrentUser({
          id: data.user.id,
          email: data.user.email,
          full_name: data.user.full_name ?? data.user.name ?? '',
          name: data.user.name ?? data.user.full_name ?? '',
          role: data.user.role,
          org_id: data.user.org_id,
          phone: data.user.phone,
          photo_url: data.user.photo_url,
        })

        router.push('/dashboard')
        router.refresh()
      } else {
        setError('Respuesta inesperada del servidor')
        setLoading(false)
      }
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 relative overflow-hidden">
      {/* Radio y sombra de token (regla 8): eran `rounded-2xl` + `shadow-xl` +
          un borde blanco translúcido, de antes de que existieran. */}
      <div className="bg-white rounded-card shadow-pop p-5 sm:p-8 w-full max-w-md relative z-10 border border-gray-200">
        <div className="text-center mb-6 sm:mb-8">
          <img src="/brand/logo-horizontal.png" alt="VendéPro" className="h-12 sm:h-16 mx-auto mb-3 sm:mb-4" />
          <Heading level={2}>CRM Inmobiliario</Heading>
          <Text size="sm" tone="muted" className="mt-1">Ingresá con tu cuenta de agente</Text>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
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

          <Field label="Contraseña">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </Field>

          <Button type="submit" size="lg" fullWidth loading={loading}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </Button>

          <div className="text-center">
            <Link href="/forgot-password" className="text-sm text-gray-500 hover:text-primary transition-colors">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </form>

        <Text size="sm" tone="muted" className="text-center mt-4">
          ¿No tenés cuenta?{' '}
          <Link href="/register" className="text-primary hover:underline font-medium">
            Registrá tu inmobiliaria
          </Link>
        </Text>
      </div>
    </div>
  )
}
