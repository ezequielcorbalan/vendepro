'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#ff007c]/5 via-white to-[#ff8017]/5 px-4 relative overflow-hidden">
      <img
        src="/brand/GV-27.png"
        alt=""
        aria-hidden="true"
        className="absolute -top-20 -left-20 w-96 h-96 opacity-20 pointer-events-none"
      />
      <img
        src="/brand/ELEMENTOS-28.png"
        alt=""
        aria-hidden="true"
        className="absolute -bottom-24 -right-16 w-80 h-80 opacity-10 pointer-events-none"
      />
      <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-8 w-full max-w-md relative z-10 border border-white/50">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[#ff007c] to-[#ff8017] rounded-t-2xl" />
        <div className="text-center mb-6 sm:mb-8">
          <img src="/brand/logo-horizontal.png" alt="VendéPro" className="h-12 sm:h-16 mx-auto mb-3 sm:mb-4" />
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">CRM Inmobiliario</h1>
          <p className="text-gray-500 text-sm mt-1">Ingresá con tu cuenta de agente</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">{error}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-br from-[#ff007c] to-[#ff8017] text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>

          <div className="text-center">
            <Link href="/forgot-password" className="text-sm text-gray-500 hover:text-[#ff007c] transition-colors">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          ¿No tenés cuenta?{' '}
          <Link href="/register" className="text-[#ff007c] hover:underline font-medium">
            Registrá tu inmobiliaria
          </Link>
        </p>
      </div>
    </div>
  )
}
