'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'

export default function NuevoAgentePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role: 'agent',
  })

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setSuccess('')
    try {
      const res = await apiFetch('admin', '/create-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = (await res.json()) as any
      if (data.id || data.success) {
        setSuccess(`Agente ${form.full_name} creado exitosamente. Puede ingresar con email: ${form.email}`)
        setForm({ full_name: '', email: '', phone: '', password: '', role: 'agent' })
      } else {
        toast(data.error || 'Error al crear agente', 'error')
      }
    } catch { toast('Error de conexión', 'error') }
    setLoading(false)
  }

  const inputClass = 'w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ff007c]/50 focus:border-[#ff007c]'

  return (
    <div>
      <Link href="/admin/agentes" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Volver
      </Link>

      <h1 className="text-2xl font-semibold text-gray-800 mb-6">Nuevo agente</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        {success && <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg">{success}</div>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nombre completo *</label>
          <input
            type="text"
            value={form.full_name}
            onChange={e => update('full_name', e.target.value)}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
          <input
            type="email"
            value={form.email}
            onChange={e => update('email', e.target.value)}
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => update('phone', e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña inicial *</label>
          <input
            type="text"
            value={form.password}
            onChange={e => update('password', e.target.value)}
            required
            minLength={6}
            placeholder="Mínimo 6 caracteres"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
          <select value={form.role} onChange={e => update('role', e.target.value)} className={inputClass}>
            <option value="agent">Agente</option>
            <option value="admin">Administrador</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#ff007c] text-white py-2.5 rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {loading ? 'Creando...' : 'Crear agente'}
        </button>
      </form>
    </div>
  )
}
