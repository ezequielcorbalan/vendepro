'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
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
        <div className="bg-green-50 text-green-700 text-sm p-4 rounded-lg">
          ¡Contraseña actualizada correctamente! Ya podés ingresar con tu nueva contraseña.
        </div>
        <Link
          href="/login"
          className="block w-full text-center bg-[#ff007c] text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity"
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
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
          {error}
          {isInvalidToken && (
            <span>
              {' '}
              <Link href="/forgot-password" className="underline font-medium">
                Solicitá un nuevo link
              </Link>
            </span>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nueva contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          disabled={!token}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c] disabled:bg-gray-100"
          placeholder="Mínimo 8 caracteres"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Repetir contraseña</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          disabled={!token}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c] disabled:bg-gray-100"
          placeholder="Repetí la contraseña"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !token}
        className="w-full bg-[#ff007c] text-white font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? 'Guardando...' : 'Guardar contraseña'}
      </button>

      <p className="text-center text-sm text-gray-500">
        <Link href="/login" className="text-[#ff007c] hover:underline font-medium">
          Volver al inicio de sesión
        </Link>
      </p>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="VendéPro" className="h-12 sm:h-16 mx-auto mb-3" />
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">Nueva contraseña</h1>
          <p className="text-gray-500 text-sm mt-1">Elegí una contraseña segura para tu cuenta</p>
        </div>
        <Suspense fallback={<div className="text-center text-sm text-gray-400">Cargando...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
